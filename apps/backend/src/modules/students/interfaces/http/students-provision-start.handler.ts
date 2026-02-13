import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";
import { runStudentsProvisionTransaction } from "./students-provision-transaction.service";

export async function handleStudentsProvisionStartRequest(params: {
  fastify: FastifyInstance;
  request: any;
  reply: any;
  deps: StudentsHttpDeps;
}) {
  const { fastify, request, reply, deps } = params;
  const { studentsRepo,
    requireTeacherClassScope,
    sendHttpError,
    ensureProvisioningAuth,
    normalizeNamePart,
    normalizeGender,
    splitFullName,
    buildFullName,
    logProvisioningEvent,
    DEVICE_STUDENT_ID_STRATEGY,
  } = deps;

  let auditSchoolId: string | null = null;
  let auditRequestId: string | undefined;
  let auditClassId: string | null = null;
  let auditFirstName = "";
  let auditLastName = "";
  let auditTargetDeviceIds: string[] = [];
  let auditTargetAllActive = true;

  try {
    const { schoolId } = request.params as { schoolId: string };
    auditSchoolId = schoolId;
    const auth = await ensureProvisioningAuth(request, reply, schoolId);
    if (!auth) return;

    const body = request.body || {};
    const studentPayload = body.student || body;
    const faceImageBase64 = studentPayload?.faceImageBase64 || body?.faceImageBase64 || "";
    const studentId = body.studentId as string | undefined;
    const requestId = body.requestId ? String(body.requestId) : undefined;
    const targetDeviceIds = Array.isArray(body.targetDeviceIds)
      ? (body.targetDeviceIds as string[])
      : [];
    const targetAllActive = body.targetAllActive !== false;
    auditRequestId = requestId;
    auditTargetDeviceIds = targetDeviceIds;
    auditTargetAllActive = targetAllActive;
    fastify.log.info(
      {
        schoolId,
        requestId,
        studentId,
        hasImage: Boolean(body?.faceImageBase64 || body?.faceImage),
        classId: studentPayload?.classId || body?.classId,
        targetDeviceIdsCount: targetDeviceIds.length,
        targetAllActive,
      },
      "students.provision start",
    );

    const payloadFirstName = normalizeNamePart(studentPayload?.firstName || "");
    const payloadLastName = normalizeNamePart(studentPayload?.lastName || "");
    const payloadFatherName = normalizeNamePart(studentPayload?.fatherName || "");
    const payloadGender = normalizeGender(studentPayload?.gender);
    const payloadName = normalizeNamePart(studentPayload?.name || "");
    const nameParts =
      payloadFirstName || payloadLastName
        ? { firstName: payloadFirstName, lastName: payloadLastName }
        : splitFullName(payloadName);
    const firstName = normalizeNamePart(nameParts.firstName);
    const lastName = normalizeNamePart(nameParts.lastName);
    auditFirstName = firstName;
    auditLastName = lastName;
    const fullName = buildFullName(lastName, firstName);

    if (!firstName || !lastName) {
      await logProvisioningEvent({
        schoolId,
        level: "ERROR",
        stage: "PROVISIONING_START",
        status: "FAILED",
        message: "Ism va familiya majburiy",
        payload: {
          requestId,
          targetDeviceIds,
          targetAllActive,
          classId: studentPayload.classId || null,
        },
      });
      return reply.status(400).send({ error: "Ism va familiya majburiy" });
    }
    if (!payloadGender) {
      await logProvisioningEvent({
        schoolId,
        level: "ERROR",
        stage: "PROVISIONING_START",
        status: "FAILED",
        message: "Gender noto'g'ri yoki bo'sh",
        payload: {
          requestId,
          targetDeviceIds,
          targetAllActive,
          classId: studentPayload.classId || null,
        },
      });
      return reply.status(400).send({ error: "Gender noto'g'ri yoki bo'sh" });
    }

    let classId: string | null = null;
    const providedDeviceStudentId =
      typeof studentPayload.deviceStudentId === "string"
        ? studentPayload.deviceStudentId.trim()
        : "";

    if (
      providedDeviceStudentId &&
      DEVICE_STUDENT_ID_STRATEGY === "numeric" &&
      !/^\d+$/.test(providedDeviceStudentId)
    ) {
      await logProvisioningEvent({
        schoolId,
        level: "ERROR",
        stage: "PROVISIONING_START",
        status: "FAILED",
        message: "deviceStudentId must be numeric",
        payload: {
          requestId,
          targetDeviceIds,
          targetAllActive,
          classId: studentPayload.classId || null,
        },
      });
      return reply.status(400).send({ error: "deviceStudentId must be numeric" });
    }

    if (studentPayload.classId) {
      console.log("[Provision] Checking class:", {
        classId: studentPayload.classId,
        classIdType: typeof studentPayload.classId,
        schoolId,
        schoolIdType: typeof schoolId,
      });

      const classExists = await studentsRepo.class.findFirst({
        where: { id: String(studentPayload.classId), schoolId },
      });

      console.log("[Provision] Class lookup result:", {
        found: !!classExists,
        classExists: classExists ? { id: classExists.id, name: classExists.name } : null,
      });

      if (!classExists) {
        console.error("[Provision] Class not found in DB!", {
          searchedFor: { classId: String(studentPayload.classId), schoolId },
        });
        await logProvisioningEvent({
          schoolId,
          level: "ERROR",
          stage: "PROVISIONING_START",
          status: "FAILED",
          message: "Class not found",
          payload: {
            requestId,
            targetDeviceIds,
            targetAllActive,
            classId: String(studentPayload.classId),
          },
        });
        return reply.status(400).send({ error: "Class not found" });
      }
      classId = String(studentPayload.classId);
      auditClassId = classId;
    }

    if (!classId) {
      await logProvisioningEvent({
        schoolId,
        level: "ERROR",
        stage: "PROVISIONING_START",
        status: "FAILED",
        message: "Sinf tanlanishi shart",
        payload: {
          requestId,
          targetDeviceIds,
          targetAllActive,
          classId: null,
        },
      });
      return reply.status(400).send({ error: "Sinf tanlanishi shart" });
    }
    if (auth.user?.role === "TEACHER") {
      await requireTeacherClassScope(auth.user, classId);
    }

    const result = await runStudentsProvisionTransaction({
      deps,
      schoolId,
      requestId,
      studentId,
      providedDeviceStudentId,
      classId,
      firstName,
      lastName,
      fullName,
      studentPayload,
      payloadGender,
      payloadFatherName,
      targetDeviceIds,
      targetAllActive,
      faceImageBase64,
    });

    await logProvisioningEvent({
      schoolId,
      studentId: result.student.id,
      provisioningId: result.provisioning.id,
      level: result.provisioning.status === "FAILED" ? "ERROR" : "INFO",
      stage: "PROVISIONING_START",
      status: result.provisioning.status,
      message: result.provisioning.lastError || null,
      payload: {
        requestId,
        targetDeviceIds,
        targetAllActive,
        classId,
      },
    });

    fastify.log.info(
      {
        schoolId,
        studentId: result.student.id,
        provisioningId: result.provisioning.id,
        status: result.provisioning.status,
        targetDevices: result.targetDevices.length,
      },
      "students.provision success",
    );

    return {
      student: result.student,
      studentId: result.student.id,
      provisioningId: result.provisioning.id,
      deviceStudentId: result.student.deviceStudentId,
      provisioningStatus: result.provisioning.status,
      targetDevices: result.targetDevices,
    };
  } catch (err: any) {
    fastify.log.error(
      { err, schoolId: auditSchoolId, requestId: auditRequestId },
      "students.provision failed",
    );
    if (auditSchoolId) {
      await logProvisioningEvent({
        schoolId: auditSchoolId,
        level: "ERROR",
        stage: "PROVISIONING_START",
        status: "FAILED",
        message: err?.message || "Provisioning start failed",
        payload: {
          requestId: auditRequestId,
          classId: auditClassId,
          firstName: auditFirstName,
          lastName: auditLastName,
          targetDeviceIds: auditTargetDeviceIds,
          targetAllActive: auditTargetAllActive,
        },
      });
    }
    return sendHttpError(reply, err);
  }
}

