import { StudentsHttpDeps } from "./students.routes.deps";
import {
  collectImportCommitUniqueValues,
  getInvalidImportCommitRows,
  normalizeDeviceImportCommitRows,
} from "./students-device-import-commit.rows";

export function createStudentsDeviceImportCommitHandler(deps: StudentsHttpDeps) {
  const { studentsRepo,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    acquireImportLocks,
    createImportJob,
    getIdempotentResult,
    recordImportMetrics,
    releaseImportLocks,
    setIdempotentResult,
    updateImportJob,
    normalizeNamePart,
    buildFullName,
    normalizeGender,
    logProvisioningEvent,
  } = deps;

  return async (request: any, reply: any) => {
    const startedAtMs = Date.now();
    let jobId: string | null = null;
    let lockEmployeeNos: string[] = [];
    let retryMode = false;
    try {
      const { schoolId } = request.params as { schoolId: string };
      const user = request.user;
      const body = request.body || {};

      requireRoles(user, ["SCHOOL_ADMIN"]);
      requireSchoolScope(user, schoolId);

      const idempotencyKey = String(body.idempotencyKey || "").trim();
      if (idempotencyKey) {
        const cached = getIdempotentResult(schoolId, idempotencyKey);
        if (cached) {
          return { ...cached, idempotent: true };
        }
      }

      const rawRows = Array.isArray(body.rows) ? body.rows : [];
      if (rawRows.length === 0) {
        return reply.status(400).send({ error: "rows is required" });
      }

      const rows = normalizeDeviceImportCommitRows(
        rawRows,
        normalizeNamePart,
        normalizeGender,
      );
      const { classIds, employeeNos } = collectImportCommitUniqueValues(rows);
      lockEmployeeNos = employeeNos;
      retryMode = Boolean(body?.retryMode);

      const lock = acquireImportLocks(schoolId, employeeNos);
      if (!lock.ok) {
        return reply
          .status(409)
          .send({ error: "Import lock conflict", conflicts: lock.conflicts });
      }

      const [classes, existing] = await Promise.all([
        classIds.length === 0
          ? []
          : studentsRepo.class.findMany({
              where: { schoolId, id: { in: classIds } },
              select: { id: true },
            }),
        employeeNos.length === 0
          ? []
          : studentsRepo.student.findMany({
              where: { schoolId, deviceStudentId: { in: employeeNos } },
              select: {
                id: true,
                deviceStudentId: true,
                firstName: true,
                lastName: true,
                classId: true,
              },
            }),
      ]);

      const classSet = new Set(classes.map((c) => c.id));
      const existingMap = new Map(
        existing.map((s) => [String(s.deviceStudentId || ""), s]),
      );
      const invalidRows = getInvalidImportCommitRows(rows, classSet);

      if (invalidRows.length > 0) {
        return reply.status(400).send({
          error: "Validation failed",
          invalidCount: invalidRows.length,
        });
      }

      const created: Array<{ id: string; deviceStudentId: string | null }> = [];
      const updated: Array<{ id: string; deviceStudentId: string | null }> = [];
      const beforeAfter: Array<{
        employeeNo: string;
        before: any;
        after: any;
      }> = [];

      const localJobId = crypto.randomUUID();
      jobId = localJobId;
      createImportJob({
        id: localJobId,
        schoolId,
        totalRows: rows.length,
      });
      updateImportJob(localJobId, { status: "PROCESSING" as any });

      const students = await studentsRepo.$transaction(async (tx) => {
        const out: Array<{
          id: string;
          deviceStudentId: string | null;
          firstName: string;
          lastName: string;
        }> = [];
        for (const row of rows) {
          const existingStudent = existingMap.get(row.employeeNo);
          const fullName = buildFullName(row.lastName, row.firstName);
          const result = await tx.student.upsert({
            where: {
              schoolId_deviceStudentId: {
                schoolId,
                deviceStudentId: row.employeeNo,
              },
            },
            update: {
              name: fullName,
              firstName: row.firstName,
              lastName: row.lastName,
              fatherName: row.fatherName || null,
              classId: row.classId,
              parentPhone: row.parentPhone || null,
              gender: row.gender,
              isActive: true,
            },
            create: {
              schoolId,
              deviceStudentId: row.employeeNo,
              name: fullName,
              firstName: row.firstName,
              lastName: row.lastName,
              fatherName: row.fatherName || null,
              classId: row.classId,
              parentPhone: row.parentPhone || null,
              gender: row.gender,
            },
          });

          beforeAfter.push({
            employeeNo: row.employeeNo,
            before: existingStudent
              ? {
                  id: existingStudent.id,
                  firstName: existingStudent.firstName,
                  lastName: existingStudent.lastName,
                  classId: existingStudent.classId,
                }
              : null,
            after: {
              id: result.id,
              firstName: result.firstName,
              lastName: result.lastName,
              classId: result.classId,
            },
          });

          if (existingStudent) {
            updated.push({
              id: result.id,
              deviceStudentId: result.deviceStudentId,
            });
          } else {
            created.push({
              id: result.id,
              deviceStudentId: result.deviceStudentId,
            });
          }
          out.push({
            id: result.id,
            deviceStudentId: result.deviceStudentId,
            firstName: result.firstName,
            lastName: result.lastName,
          });
        }
        return out;
      });

      const durationMs = Date.now() - startedAtMs;
      updateImportJob(localJobId, {
        status: "SUCCESS" as any,
        processed: rows.length,
        success: rows.length,
        failed: 0,
        synced: 0,
        finishedAt: new Date(),
      });
      recordImportMetrics({
        schoolId,
        success: rows.length,
        failed: 0,
        synced: 0,
        latencyMs: durationMs,
        isRetry: retryMode,
      });

      const resultPayload = {
        ok: true,
        idempotent: false,
        jobId: localJobId,
        createdCount: created.length,
        updatedCount: updated.length,
        created,
        updated,
        students,
      };

      await logProvisioningEvent({
        schoolId,
        level: "INFO",
        stage: "DEVICE_IMPORT_COMMIT",
        status: "SUCCESS",
        message: `Import commit done (${rows.length} rows)`,
        payload: {
          actorId: user?.sub || null,
          actorRole: user?.role || null,
          sourceDeviceId: body?.sourceDeviceId || null,
          syncMode: body?.syncMode || "none",
          targetDeviceIds: Array.isArray(body?.targetDeviceIds)
            ? body.targetDeviceIds
            : [],
          jobId: localJobId,
          createdCount: created.length,
          updatedCount: updated.length,
          beforeAfter: beforeAfter.slice(0, 200),
        },
      });

      if (idempotencyKey) {
        setIdempotentResult(schoolId, idempotencyKey, resultPayload);
      }

      return resultPayload;
    } catch (err: any) {
      if (jobId) {
        updateImportJob(jobId, {
          status: "FAILED" as any,
          lastError: err?.message || "Import failed",
          finishedAt: new Date(),
        });
      }
      recordImportMetrics({
        schoolId: (request.params as any)?.schoolId || "",
        success: 0,
        failed: 1,
        synced: 0,
        latencyMs: Date.now() - startedAtMs,
        isRetry: retryMode,
      });
      return sendHttpError(reply, err);
    } finally {
      if ((request.params as any)?.schoolId && lockEmployeeNos.length > 0) {
        releaseImportLocks((request.params as any).schoolId, lockEmployeeNos);
      }
    }
  };
}

