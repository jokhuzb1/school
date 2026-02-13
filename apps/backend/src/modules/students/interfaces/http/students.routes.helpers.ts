import { Prisma } from "@prisma/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  DEVICE_STUDENT_ID_LENGTH,
  DEVICE_STUDENT_ID_STRATEGY,
  PROVISIONING_TOKEN,
} from "../../../../config";
import { getUploadsDir } from "../../../../app/runtime/paths";
import prisma from "../../../../prisma";
import { createStudentsHttpPrismaRepository } from "../../infrastructure/students-http.prisma-repository";
import {
  requireSchoolScope,
  requireStudentSchoolScope,
  requireTeacherClassScope,
} from "../../../../utils/authz";

const studentsRepo = createStudentsHttpPrismaRepository(prisma);

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\*/, "")
    .trim()
    .toLowerCase();
}

export function normalizeNamePart(value: string): string {
  return String(value || "").trim();
}

export function buildFullName(lastName: string, firstName: string): string {
  const parts = [normalizeNamePart(lastName), normalizeNamePart(firstName)].filter(
    Boolean,
  );
  return parts.join(" ").trim();
}

export function splitFullName(
  fullName: string,
): { firstName: string; lastName: string } {
  const cleaned = normalizeNamePart(fullName);
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(" "),
  };
}

export function normalizeGender(value: unknown): "MALE" | "FEMALE" | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (["male", "erkak", "m", "1"].includes(raw)) return "MALE";
  if (["female", "ayol", "f", "2"].includes(raw)) return "FEMALE";
  return null;
}

export const STUDENT_HAS_SPLIT_NAME_FIELDS = (() => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "Student");
  const fields = new Set((model?.fields || []).map((f) => f.name));
  return fields.has("firstName") && fields.has("lastName");
})();

export function buildDuplicateStudentWhere(params: {
  schoolId: string;
  classId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  excludeId?: string;
}): Prisma.StudentWhereInput {
  const candidates: Prisma.StudentWhereInput[] = [
    {
      name: {
        equals: params.fullName,
        mode: "insensitive",
      },
    },
  ];

  if (STUDENT_HAS_SPLIT_NAME_FIELDS) {
    candidates.push({
      firstName: {
        equals: params.firstName,
        mode: "insensitive",
      },
      lastName: {
        equals: params.lastName,
        mode: "insensitive",
      },
    });
  }

  const where: Prisma.StudentWhereInput = {
    schoolId: params.schoolId,
    classId: params.classId,
    isActive: true,
    OR: candidates,
  };

  if (params.excludeId) {
    where.NOT = { id: params.excludeId };
  }

  return where;
}

export async function logProvisioningEvent(params: {
  schoolId: string;
  studentId?: string | null;
  provisioningId?: string | null;
  deviceId?: string | null;
  level?: "INFO" | "WARN" | "ERROR";
  eventType?: string | null;
  stage: string;
  status?: string | null;
  message?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  actorIp?: string | null;
  userAgent?: string | null;
  source?: string | null;
  payload?: Record<string, any> | null;
}) {
  try {
    await studentsRepo.provisioningLog.create({
      data: {
        schoolId: params.schoolId,
        studentId: params.studentId || null,
        provisioningId: params.provisioningId || null,
        deviceId: params.deviceId || null,
        level: params.level || "INFO",
        eventType: params.eventType || params.stage,
        stage: params.stage,
        status: params.status || null,
        message: params.message || null,
        actorId: params.actorId || null,
        actorRole: params.actorRole || null,
        actorName: params.actorName || null,
        actorIp: params.actorIp || null,
        userAgent: params.userAgent || null,
        source: params.source || "BACKEND_API",
        payload: params.payload || undefined,
      },
    });
  } catch (err) {
    console.error("[ProvisioningLog] Failed to write log:", err);
  }
}

export function normalizeBase64(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) return "";
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma !== -1) {
    return trimmed.slice(comma + 1).trim();
  }
  return trimmed;
}

export function isBase64(value: string): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value.replace(/\s+/g, "");
  } catch {
    return false;
  }
}

export async function saveStudentFaceImage(params: {
  studentId: string;
  faceImageBase64: string;
}): Promise<string | null> {
  const base64 = normalizeBase64(params.faceImageBase64);
  if (!base64 || !isBase64(base64)) return null;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) return null;
  const uploadsDir = getUploadsDir("student-faces");
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const filename = `${params.studentId}.jpg`;
  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/student-faces/${filename}`;
}

export type ProvisioningAuth = { user: any | null; tokenAuth: boolean };

export async function ensureProvisioningAuth(
  request: any,
  reply: any,
  schoolId: string,
  studentId?: string,
): Promise<ProvisioningAuth | null> {
  const tokenFromHeader =
    request.headers?.["x-provisioning-token"] ||
    request.headers?.["X-Provisioning-Token"];
  const tokenFromQuery = request.query?.provisioningToken;
  const authHeader = request.headers?.authorization as string | undefined;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;
  const providedToken = String(
    tokenFromHeader || tokenFromQuery || bearerToken || "",
  ).trim();

  if (PROVISIONING_TOKEN && providedToken === PROVISIONING_TOKEN) {
    return { user: null, tokenAuth: true };
  }

  try {
    await request.jwtVerify();
    const user = request.user;
    if (!user?.role || !["SCHOOL_ADMIN", "TEACHER"].includes(user.role)) {
      reply.status(403).send({ error: "forbidden" });
      return null;
    }
    requireSchoolScope(user, schoolId);
    if (studentId && user.role === "TEACHER") {
      const student = await requireStudentSchoolScope(user, studentId);
      if (!student.classId) {
        reply.status(403).send({ error: "forbidden" });
        return null;
      }
      await requireTeacherClassScope(user, student.classId);
    }
    return { user, tokenAuth: false };
  } catch (err: any) {
    if (err?.statusCode === 403) {
      reply.status(403).send({ error: "forbidden" });
      return null;
    }
    if (err?.statusCode === 404) {
      reply.status(404).send({ error: "not found" });
      return null;
    }
    reply.status(401).send({ error: "Unauthorized" });
    return null;
  }
}

export function computeProvisioningStatus(
  links: Array<{ status: "PENDING" | "SUCCESS" | "FAILED" }>,
): "PROCESSING" | "PARTIAL" | "CONFIRMED" | "FAILED" {
  if (links.length === 0) return "PROCESSING";
  const success = links.filter((l) => l.status === "SUCCESS").length;
  const failed = links.filter((l) => l.status === "FAILED").length;
  if (success === links.length) return "CONFIRMED";
  if (failed === links.length) return "FAILED";
  if (failed > 0) return "PARTIAL";
  return "PROCESSING";
}

export async function generateDeviceStudentId(
  tx: Prisma.TransactionClient,
  schoolId: string,
): Promise<string> {
  const strategy = DEVICE_STUDENT_ID_STRATEGY;
  if (strategy === "numeric") {
    const length = Math.max(6, Math.min(20, DEVICE_STUDENT_ID_LENGTH || 10));
    for (let i = 0; i < 10; i++) {
      let value = "";
      while (value.length < length) {
        value += Math.floor(Math.random() * 10).toString();
      }
      value = value.substring(0, length);
      const existing = await tx.student.findUnique({
        where: {
          schoolId_deviceStudentId: { schoolId, deviceStudentId: value },
        },
        select: { id: true },
      });
      if (!existing) return value;
    }
    throw Object.assign(new Error("Failed to generate numeric device ID"), {
      statusCode: 500,
    });
  }
  return crypto.randomUUID();
}

