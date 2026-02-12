import { FastifyInstance, FastifyRequest } from "fastify";
import { MIN_SCAN_INTERVAL_SECONDS } from "../../../../config";
import { emitAttendance } from "../../../../eventEmitter";
import prisma from "../../../../prisma";
import { createAttendanceHttpPrismaRepository } from "../../infrastructure/attendance-http.prisma-repository";
import { markClassDirty, markSchoolDirty } from "../../../../realtime/snapshotScheduler";
import { getTimePartsInZone } from "../../../../utils/date";
import { prepareWebhookContext, PrepareWebhookOptions } from "./webhook-event.prepare";

const attendanceRepo = createAttendanceHttpPrismaRepository(prisma);

export const handleAttendanceEvent = async (
  school: any,
  direction: string,
  accessEventJson: any,
  savedPicturePath: string | null,
  opts?: {
    fastify?: FastifyInstance;
    request?: FastifyRequest;
    normalizedEvent?: PrepareWebhookOptions["normalizedEvent"];
  },
) => {
  const prepared = await prepareWebhookContext(
    school,
    direction,
    accessEventJson,
    savedPicturePath,
    {
      fastify: opts?.fastify,
      request: opts?.request,
      normalizedEvent: opts?.normalizedEvent,
    },
  );

  if (!("context" in prepared)) {
    return prepared;
  }

  const {
    rawPayload,
    eventTime,
    eventType,
    schoolTimeZone,
    dateOnly,
    isTodayEvent,
    eventKey,
    device,
    student,
    cls,
    audit,
  } = prepared.context;

  let event: any = null;
  let statusReason: string | null = null;
  let computedDiff: number | null = null;
  let updatedStatus: string | null = null;
  let createdStatus: string | null = null;
  let createdLateMinutes: number | null = null;

  try {
    const txResult = await attendanceRepo.$transaction(async (tx) => {
      const existing = student
        ? await tx.dailyAttendance.findUnique({
            where: { studentId_date: { studentId: student.id, date: dateOnly } },
          })
        : null;

      if (student && existing) {
        const MIN_SCAN_INTERVAL = Math.max(0, MIN_SCAN_INTERVAL_SECONDS) * 1000;
        if (
          eventType === "IN" &&
          existing.currentlyInSchool &&
          existing.lastInTime
        ) {
          const timeSinceLastIn =
            eventTime.getTime() - new Date(existing.lastInTime).getTime();
          if (timeSinceLastIn < MIN_SCAN_INTERVAL) {
            return { kind: "duplicate_scan" as const, event: null, existing };
          }
        }
        if (
          eventType === "OUT" &&
          !existing.currentlyInSchool &&
          existing.lastOutTime
        ) {
          const timeSinceLastOut =
            eventTime.getTime() - new Date(existing.lastOutTime).getTime();
          if (timeSinceLastOut < MIN_SCAN_INTERVAL) {
            return { kind: "duplicate_scan" as const, event: null, existing };
          }
        }
      }

      const createdEvent = await tx.attendanceEvent.create({
        data: {
          eventKey,
          studentId: student?.id,
          schoolId: school.id,
          deviceId: device?.id,
          eventType,
          timestamp: eventTime,
          rawPayload: { ...rawPayload, _savedPicture: savedPicturePath },
        } as any,
      });

      if (!student) {
        return { kind: "event_only" as const, event: createdEvent, existing: null };
      }

      if (existing) {
        const update: any = {
          lastScanTime: eventTime,
          scanCount: existing.scanCount + 1,
        };

        if (eventType === "IN") {
          if (!existing.firstScanTime && cls) {
            const [h, m] = cls.startTime.split(":").map(Number);
            const timeParts = getTimePartsInZone(eventTime, schoolTimeZone);
            const diff = timeParts.hours * 60 + timeParts.minutes - (h * 60 + m);
            const afterAbsenceCutoff = diff >= school.absenceCutoffMinutes;
            computedDiff = diff;

            if (existing.status === "ABSENT") {
              update.status = "ABSENT";
              update.lateMinutes = null;
              statusReason = "existing_absent";
            } else if (afterAbsenceCutoff) {
              update.status = "ABSENT";
              update.lateMinutes = null;
              statusReason = "absent_cutoff";
            } else if (diff >= school.lateThresholdMinutes) {
              update.status = "LATE";
              update.lateMinutes = Math.round(diff - school.lateThresholdMinutes);
              statusReason = "late_threshold";
            } else {
              update.status = "PRESENT";
              update.lateMinutes = null;
              statusReason = "present";
            }
          }
          if (!existing.firstScanTime) {
            update.firstScanTime = eventTime;
          }
          update.lastInTime = eventTime;
          update.currentlyInSchool = true;
        } else {
          update.lastOutTime = eventTime;
          update.currentlyInSchool = false;
          if (existing.lastInTime && existing.currentlyInSchool) {
            const sessionMinutes = Math.round(
              (eventTime.getTime() - new Date(existing.lastInTime).getTime()) / 60000,
            );
            if (sessionMinutes > 0 && sessionMinutes < 720) {
              update.totalTimeOnPremises =
                (existing.totalTimeOnPremises || 0) + sessionMinutes;
            }
          }
        }

        updatedStatus = update.status || existing.status;

        await tx.dailyAttendance.update({
          where: { id: existing.id },
          data: update,
        });

        return { kind: "updated" as const, event: createdEvent, existing };
      }

      let status: any = "PRESENT";
      let lateMinutes: number | null = null;

      if (eventType === "IN" && cls) {
        const [h, m] = cls.startTime.split(":").map(Number);
        const timeParts = getTimePartsInZone(eventTime, schoolTimeZone);
        const diff = timeParts.hours * 60 + timeParts.minutes - (h * 60 + m);
        if (diff >= school.absenceCutoffMinutes) {
          status = "ABSENT";
          lateMinutes = null;
        } else if (diff >= school.lateThresholdMinutes) {
          status = "LATE";
          lateMinutes = Math.round(diff - school.lateThresholdMinutes);
        }
      }

      createdStatus = status;
      createdLateMinutes = lateMinutes;

      await tx.dailyAttendance.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          date: dateOnly,
          status,
          firstScanTime: eventType === "IN" ? eventTime : null,
          lastScanTime: eventTime,
          lateMinutes,
          lastInTime: eventType === "IN" ? eventTime : null,
          lastOutTime: eventType === "OUT" ? eventTime : null,
          currentlyInSchool: eventType === "IN",
          scanCount: 1,
          notes: eventType === "OUT" ? "OUT before first IN" : null,
        },
      });

      return { kind: "created" as const, event: createdEvent, existing: null };
    });

    if (txResult.kind === "duplicate_scan") {
      audit({
        action: "webhook.duplicate_scan",
        level: "info",
        message: "Duplikat scan bekor qilindi",
        extra: { eventType },
      });
      return { ok: true, ignored: true, reason: "duplicate_scan" };
    }

    event = txResult.event;
  } catch (err: any) {
    if (err?.code === "P2002") {
      audit({
        action: "webhook.duplicate_event",
        level: "info",
        message: "Duplikat event bekor qilindi",
        extra: { eventKey, direction },
      });
      return { ok: true, ignored: true, reason: "duplicate_event" };
    }
    throw err;
  }

  if (student && updatedStatus) {
    audit({
      action: "webhook.attendance.update",
      level: "info",
      message: `Holat yangilandi`,
      extra: {
        diff: computedDiff,
        reason: statusReason,
        eventType,
        newStatus: updatedStatus,
      },
    });
  }

  if (student && createdStatus) {
    audit({
      action: "webhook.attendance.create",
      level: "info",
      message: `Yangi rekord: ${createdStatus}`,
      extra: {
        eventType,
        status: createdStatus,
        lateMinutes: createdLateMinutes,
      },
    });
  }

  if (student && savedPicturePath) {
    attendanceRepo.student
      .update({
        where: { id: student.id },
        data: { photoUrl: savedPicturePath },
      })
      .catch(() => {});
  }

  const eventPayload = {
    schoolId: school.id,
    event: {
      ...event,
      student: student
        ? {
            id: student.id,
            name: student.name,
            classId: cls ? cls.id : null,
            class: cls ? { name: cls.name } : null,
          }
        : null,
    },
  };

  if (isTodayEvent) {
    emitAttendance(eventPayload);

    markSchoolDirty(school.id);
    if (eventPayload.event?.student?.classId) {
      markClassDirty(school.id, eventPayload.event.student.classId);
    }
  }

  return { ok: true, event };
};

