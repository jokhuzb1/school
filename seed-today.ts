import { PrismaClient, AttendanceStatus } from "@prisma/client";
import { getLocalDateOnly } from "./src/utils/date";

const prisma = new PrismaClient();

const SCHOOL_NAME = "Namangan 1-maktab";
const LATE_THRESHOLD = 15;

async function main() {
  console.log(`🚀 Seeding today's attendance data for ${SCHOOL_NAME}...`);

  const school = await prisma.school.findFirst({
    where: { name: SCHOOL_NAME },
  });

  if (!school) {
    console.error(`❌ School "${SCHOOL_NAME}" not found!`);
    return;
  }

  const students = await prisma.student.findMany({
    where: { schoolId: school.id },
    select: { id: true, classId: true },
  });

  console.log(`📋 Found ${students.length} students.`);

  const today = getLocalDateOnly(new Date());
  console.log(`📅 Today's date (UTC): ${today.toISOString()}`);

  const batchSize = 500;
  const attendanceBatch = [];
  let count = 0;

  for (const student of students) {
    // Check if attendance already exists for today
    const existing = await prisma.dailyAttendance.findFirst({
      where: {
        studentId: student.id,
        date: today,
      },
    });

    if (existing) continue;

    const roll = Math.random();
    let status: AttendanceStatus = "PRESENT";
    let lateMinutes: number | null = null;
    let firstScanTime: Date | null = null;
    let lastScanTime: Date | null = null;

    if (roll < 0.7) {
      status = "PRESENT";
      firstScanTime = new Date(today);
      firstScanTime.setUTCHours(7, Math.floor(Math.random() * 50), Math.floor(Math.random() * 60));
    } else if (roll < 0.9) {
      status = "LATE";
      lateMinutes = Math.floor(Math.random() * 30) + 1;
      firstScanTime = new Date(today);
      firstScanTime.setUTCHours(8, LATE_THRESHOLD + lateMinutes, Math.floor(Math.random() * 60));
    } else if (roll < 0.98) {
      status = "ABSENT";
    } else {
      status = "EXCUSED";
    }

    if (firstScanTime) {
      lastScanTime = new Date(firstScanTime);
      lastScanTime.setUTCHours(firstScanTime.getUTCHours() + 5 + Math.floor(Math.random() * 2));
    }

    attendanceBatch.push({
      studentId: student.id,
      schoolId: school.id,
      date: today,
      status,
      firstScanTime,
      lastScanTime: lastScanTime || firstScanTime,
      lateMinutes,
      currentlyInSchool: status === "PRESENT" || status === "LATE",
      scanCount: firstScanTime ? 2 : 0,
    });

    count++;

    if (attendanceBatch.length >= batchSize) {
      await prisma.dailyAttendance.createMany({
        data: attendanceBatch,
        skipDuplicates: true,
      });
      attendanceBatch.length = 0;
      console.log(`  ✓ Inserted ${count} records...`);
    }
  }

  if (attendanceBatch.length > 0) {
    await prisma.dailyAttendance.createMany({
      data: attendanceBatch,
      skipDuplicates: true,
    });
  }

  console.log(`✅ Finished seeding. Total new records: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
