import cron from "node-cron";
import prisma from "../prisma";
import { logAudit } from "../utils/audit";
import {
  addDaysUtc,
  dateKeyToUtcDate,
  getDateKeyInZone,
  getDateOnlyInZone,
  getTimePartsInZone,
} from "../utils/date";

export function registerJobs(server: any) {
  // Device health check - har 30 daqiqada
  cron.schedule("*/30 * * * *", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    try {
      await prisma.device.updateMany({
        where: {
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: twoHoursAgo } }],
          isActive: true,
        },
        data: { isActive: false },
      });

      await prisma.device.updateMany({
        where: {
          lastSeenAt: { gte: twoHoursAgo },
          isActive: false,
        },
        data: { isActive: true },
      });

      server.log.info("Device health check completed");
    } catch (err) {
      server.log.error("Device health check error:", err);
    }
  });

  // ✅ FIXED: Mark Absent Job - cutoff O'TGAN barcha sinflar uchun
  // Har daqiqada ishga tushadi
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    logAudit(server, {
      action: "cron.mark_absent.run",
      level: "info",
      message: "Cutoff absent job bajarildi",
      extra: { timestamp: now.toISOString() },
    });

    try {
      const schools = await prisma.school.findMany({
        include: {
          classes: {
            select: {
              id: true,
              startTime: true,
              name: true,
            },
          },
        },
      });

      for (const school of schools) {
        try {
          const schoolTimeZone = school.timezone || "Asia/Tashkent";
          const timeParts = getTimePartsInZone(now, schoolTimeZone);
          const currentMinutes = timeParts.hours * 60 + timeParts.minutes;
          const today = getDateOnlyInZone(now, schoolTimeZone);

          // Bayram kunini tekshirish
          const holidayCount = await prisma.holiday.count({
            where: { schoolId: school.id, date: today },
          });

          if (holidayCount > 0) {
            logAudit(server, {
              action: "cron.mark_absent.skip",
              level: "info",
              message: "Bayram kuni, absent job o‘tkazildi",
              schoolId: school.id,
              extra: { date: today.toISOString() },
            });
            continue;
          }

          // ✅ FIX: Cutoff O'TGAN barcha sinflarni topish (aynan shu daqiqada emas!)
          const classesToProcess = school.classes.filter((cls) => {
            const [h, m] = cls.startTime.split(":").map(Number);
            const cutoffMinutes = h * 60 + m + school.absenceCutoffMinutes;
            return currentMinutes >= cutoffMinutes;
          });

          if (classesToProcess.length === 0) continue;

          const classIds = classesToProcess.map((c) => c.id);

          // Kelmagan o'quvchilarni ABSENT qilish (faqat hali DailyAttendance yo'q bo'lganlar)
          const result = await prisma.$executeRaw`
            INSERT INTO "DailyAttendance" ("id", "studentId", "schoolId", "date", "status", "createdAt", "updatedAt", "currentlyInSchool", "scanCount")
            SELECT 
              gen_random_uuid(),
              s.id,
              s."schoolId",
              ${today}::timestamp,
              'ABSENT'::"AttendanceStatus",
              NOW(),
              NOW(),
              false,
              0
            FROM "Student" s
            WHERE s."schoolId" = ${school.id}
              AND s."classId" = ANY(${classIds})
              AND s."isActive" = true
              AND NOT EXISTS (
                SELECT 1 FROM "DailyAttendance" da 
                WHERE da."studentId" = s.id 
                  AND da."date" >= ${today}
                  AND da."date" < ${addDaysUtc(today, 1)}
              )
          `;

          if (result > 0) {
            logAudit(server, {
              action: "cron.mark_absent",
              level: "info",
              message: `${result} o‘quvchi absentga o‘tkazildi`,
              schoolId: school.id,
              extra: {
                classes: classesToProcess.map((c) => c.id),
                inserted: Number(result),
                classNames: classesToProcess.map((c) => c.name),
              },
            });
          }
        } catch (schoolErr) {
          server.log.error(
            `Error processing school ${school.name}:`,
            schoolErr,
          );
        }
      }
    } catch (err) {
      server.log.error("Mark absent job error:", err);
    }
  });

  // End of day cleanup - har soatda, faqat yarim tunda ishlaydi
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const schools = await prisma.school.findMany({
        select: { id: true, name: true, timezone: true },
      });

      for (const school of schools) {
        const tz = school.timezone || "Asia/Tashkent";
        const timeParts = getTimePartsInZone(now, tz);
        if (timeParts.hours !== 0 || timeParts.minutes !== 0) continue;

        const todayKey = getDateKeyInZone(now, tz);
        const today = dateKeyToUtcDate(todayKey);
        const yesterdayDate = addDaysUtc(today, -1);

        // Kechagi kun uchun hali maktabda qolgan studentlarni OUT qilish
        const updatedCount = await prisma.dailyAttendance.updateMany({
          where: {
            schoolId: school.id,
            date: yesterdayDate,
            currentlyInSchool: true,
          },
          data: {
            currentlyInSchool: false,
            notes: "Auto-closed at end of day",
          },
        });

        if (updatedCount.count > 0) {
          server.log.info(
            `End of day (${school.name}): closed ${updatedCount.count} open attendance records`,
          );
        }
      }
    } catch (err) {
      server.log.error("End of day cleanup error:", err);
    }
  });

  // Weekly cleanup - eski eventlarni o'chirish
  cron.schedule("0 3 * * 1", async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedEvents = await prisma.attendanceEvent.deleteMany({
        where: {
          timestamp: { lt: thirtyDaysAgo },
        },
      });

      server.log.info(
        `Weekly cleanup: deleted ${deletedEvents.count} old attendance events`,
      );
    } catch (err) {
      server.log.error("Weekly cleanup error:", err);
    }
  });
}
