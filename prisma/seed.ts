import { PrismaClient, AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getLocalDateKey, getLocalDateOnly } from "../src/utils/date";
import crypto from "crypto";

const prisma = new PrismaClient();

type SeedConfig = {
  schools: number;
  classesPerSchool: number;
  studentsPerClass: number;
  days: number;
  includeToday: boolean;
  skipWeekends: boolean;
  lateThresholdMinutes: number;
  attendanceRate: number;
  lateRate: number;
  absentRate: number;
  excusedRate: number;
  withEvents: boolean;
  wipe: boolean;
  includeBaseSeed: boolean;
  batchSize: number;
};

const getEnvNumber = (key: string, fallback: number) => {
  const value = process.env[key];
  return value ? Number(value) : fallback;
};

const getEnvBoolean = (key: string, fallback: boolean) => {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

const config: SeedConfig = {
  schools: getEnvNumber("SEED_SCHOOLS", 10),
  classesPerSchool: getEnvNumber("SEED_CLASSES_PER_SCHOOL", 6),
  studentsPerClass: getEnvNumber("SEED_STUDENTS_PER_CLASS", 50),
  days: getEnvNumber("SEED_DAYS", 14),
  includeToday: getEnvBoolean("SEED_INCLUDE_TODAY", true),
  skipWeekends: getEnvBoolean("SEED_SKIP_WEEKENDS", true),
  lateThresholdMinutes: getEnvNumber("SEED_LATE_THRESHOLD", 15),
  attendanceRate: Number(process.env.SEED_ATTENDANCE_RATE || 0.7),
  lateRate: Number(process.env.SEED_LATE_RATE || 0.15),
  absentRate: Number(process.env.SEED_ABSENT_RATE || 0.1),
  excusedRate: Number(process.env.SEED_EXCUSED_RATE || 0.05),
  withEvents: getEnvBoolean("SEED_WITH_EVENTS", false),
  wipe: getEnvBoolean("SEED_WIPE", true),
  includeBaseSeed: getEnvBoolean("SEED_INCLUDE_BASE", true),
  batchSize: getEnvNumber("SEED_BATCH_SIZE", 1000),
};

const START_TIMES = ["08:00", "09:00", "10:00", "12:00", "14:00"];

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pickStatus = (): AttendanceStatus => {
  const roll = Math.random();
  if (roll < config.attendanceRate) return "PRESENT";
  if (roll < config.attendanceRate + config.lateRate) return "LATE";
  if (roll < config.attendanceRate + config.lateRate + config.absentRate)
    return "ABSENT";
  return "EXCUSED";
};

const buildDateList = (): Date[] => {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 0; i < config.days; i++) {
    if (!config.includeToday && i === 0) continue;
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (config.skipWeekends) {
      const day = d.getDay();
      if (day === 0 || day === 6) continue;
    }
    dates.push(getLocalDateOnly(d));
  }
  return dates;
};

const buildTime = (
  baseDate: Date,
  hour: number,
  minute: number,
  offsetMinutes: number,
): Date => {
  const d = new Date(baseDate);
  d.setHours(hour, minute + offsetMinutes, randomInt(0, 59), 0);
  return d;
};

async function flushCreateMany<T>(
  data: T[],
  handler: (payload: { data: T[] }) => Promise<unknown>,
): Promise<void> {
  if (!data.length) return;
  await handler({ data });
  data.length = 0;
}

async function main() {
  console.log("Seed config:", config);

  if (config.wipe) {
    console.log("Cleaning database...");
    await prisma.attendanceEvent.deleteMany();
    await prisma.dailyAttendance.deleteMany();
    await prisma.holiday.deleteMany();
    await prisma.student.deleteMany();
    await prisma.device.deleteMany();
    await prisma.teacherClass.deleteMany();
    await prisma.class.deleteMany();
    await prisma.user.deleteMany();
    await prisma.school.deleteMany();
  }

  const hashed = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@system.com",
      password: hashed,
      name: "Super Admin",
      role: "SUPER_ADMIN",
    },
  });

  const dateList = buildDateList();
  console.log(
    `Generating ${dateList.length} days of attendance (latest: ${getLocalDateKey(
      new Date(),
    )})`,
);

const buildEventKey = (parts: string[]) =>
  crypto.createHash("sha256").update(parts.join(":")).digest("hex");

  if (config.includeBaseSeed) {
    console.log("Creating base seed data...");

    const baseSchool = await prisma.school.create({
      data: {
        name: "School #1",
        address: "123 Main St",
        phone: "123456789",
        email: "school1@example.com",
        lateThresholdMinutes: config.lateThresholdMinutes,
        absenceCutoffMinutes: 180,
        timezone: "Asia/Tashkent",
      },
    });

    await prisma.user.create({
      data: {
        email: "school1@admin.com",
        password: hashed,
        name: "1-Maktab Admin",
        role: "SCHOOL_ADMIN",
        schoolId: baseSchool.id,
      },
    });

    const baseClass1 = await prisma.class.create({
      data: {
        name: "1A",
        gradeLevel: 1,
        schoolId: baseSchool.id,
        startTime: "18:00",
        endTime: "23:00",
      },
    });

    const baseClass2 = await prisma.class.create({
      data: {
        name: "8C",
        gradeLevel: 8,
        schoolId: baseSchool.id,
        startTime: "17:00",
        endTime: "22:00",
      },
    });

    await prisma.device.create({
      data: {
        deviceId: "1maktab",
        name: "1-Maktab Asosiy Kirish",
        schoolId: baseSchool.id,
        type: "ENTRANCE",
      },
    });

    const baseStudents = [
      {
        name: "Jaxongir Mirzaakhmedov",
        deviceStudentId: "1",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
      {
        name: "Mukhammad Mirzaakhmedov",
        deviceStudentId: "2",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
      {
        name: "Axmadxon Dexqonboyev",
        deviceStudentId: "484655",
        schoolId: baseSchool.id,
        classId: baseClass2.id,
      },
      {
        name: "G'olibjon",
        deviceStudentId: "2302209",
        schoolId: baseSchool.id,
        classId: baseClass2.id,
      },
      {
        name: "Abduvahob Abdurazzoqov",
        deviceStudentId: "6",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
      {
        name: "Saidorifxo'ja Yo'ldoshxo'jayev",
        deviceStudentId: "456585",
        schoolId: baseSchool.id,
        classId: baseClass2.id,
      },
      {
        name: "Ibroxim Sadriddinov",
        deviceStudentId: "9",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
    ];

    for (const s of baseStudents) {
      await prisma.student.create({ data: s });
    }

    console.log("Base seed data created.");
  }

  const schoolIndexOffset = config.includeBaseSeed ? 1 : 0;
  for (let schoolIndex = 1; schoolIndex <= config.schools; schoolIndex++) {
    const schoolNumber = schoolIndex + schoolIndexOffset;
    console.log(
      `Creating school ${schoolNumber}/${config.schools + schoolIndexOffset}...`,
    );

    const school = await prisma.school.create({
      data: {
        name: `School #${schoolNumber}`,
        address: `${schoolNumber} Main St`,
        phone: `100000${schoolNumber}`,
        email: `school${schoolNumber}@example.com`,
        lateThresholdMinutes: config.lateThresholdMinutes,
        absenceCutoffMinutes: 180,
        timezone: "Asia/Tashkent",
      },
    });

    await prisma.user.create({
      data: {
        email: `school${schoolNumber}@admin.com`,
        password: hashed,
        name: `School ${schoolNumber} Admin`,
        role: "SCHOOL_ADMIN",
        schoolId: school.id,
      },
    });

    const device = await prisma.device.create({
      data: {
        deviceId: `school-${schoolNumber}-entrance`,
        name: `School ${schoolNumber} Entrance`,
        schoolId: school.id,
        type: "ENTRANCE",
      },
    });

    const classRecords: Array<{
      id: string;
      startTime: string;
      name: string;
    }> = [];

    for (let i = 0; i < config.classesPerSchool; i++) {
      const gradeLevel = (i % 12) + 1;
      const section = String.fromCharCode(65 + (i % 6));
      const startTime = START_TIMES[i % START_TIMES.length];
      const cls = await prisma.class.create({
        data: {
          name: `${gradeLevel}${section}`,
          gradeLevel,
          schoolId: school.id,
          startTime,
          endTime: "15:00",
        },
      });
      classRecords.push({
        id: cls.id,
        startTime,
        name: cls.name,
      });
    }

    const classStartMap = new Map(
      classRecords.map((c) => {
        const [h, m] = c.startTime.split(":").map(Number);
        return [c.id, { hour: h, minute: m }];
      }),
    );

    const studentBatch: Array<{
      name: string;
      deviceStudentId: string;
      schoolId: string;
      classId: string;
      isActive: boolean;
    }> = [];

    let studentCounter = 1;
    for (const cls of classRecords) {
      for (let i = 0; i < config.studentsPerClass; i++) {
        studentBatch.push({
          name: `Student ${schoolIndex}-${cls.name}-${studentCounter}`,
          deviceStudentId: `S${schoolIndex}C${cls.name}N${studentCounter}`,
          schoolId: school.id,
          classId: cls.id,
          isActive: true,
        });
        studentCounter++;

        if (studentBatch.length >= config.batchSize) {
          await prisma.student.createMany({ data: studentBatch });
          studentBatch.length = 0;
        }
      }
    }
    await flushCreateMany(studentBatch, (payload) =>
      prisma.student.createMany(payload),
    );

    const students = await prisma.student.findMany({
      where: { schoolId: school.id },
      select: { id: true, classId: true },
    });

    const attendanceBatch: Array<any> = [];
    const eventBatch: Array<any> = [];

    for (const student of students) {
      const classStart = classStartMap.get(student.classId || "");
      if (!classStart) continue;

      for (const dateOnly of dateList) {
        const status = pickStatus();
        let firstScanTime: Date | null = null;
        let lastOutTime: Date | null = null;
        let lateMinutes: number | null = null;
        let totalTimeOnPremises: number | null = null;

        if (status === "PRESENT" || status === "LATE") {
          let offsetMinutes = randomInt(-10, 5);
          if (status === "LATE") {
            lateMinutes = randomInt(1, 30);
            offsetMinutes = config.lateThresholdMinutes + lateMinutes;
          }

          firstScanTime = buildTime(
            dateOnly,
            classStart.hour,
            classStart.minute,
            offsetMinutes,
          );
          lastOutTime = new Date(firstScanTime);
          lastOutTime.setMinutes(
            lastOutTime.getMinutes() + randomInt(240, 360),
          );
          totalTimeOnPremises = Math.round(
            (lastOutTime.getTime() - firstScanTime.getTime()) / 60000,
          );
        }

        attendanceBatch.push({
          studentId: student.id,
          schoolId: school.id,
          date: dateOnly,
          status,
          firstScanTime,
          lastScanTime: lastOutTime || firstScanTime,
          lateMinutes,
          totalTimeOnPremises,
          lastInTime: firstScanTime,
          lastOutTime,
          currentlyInSchool: false,
          scanCount: firstScanTime ? (lastOutTime ? 2 : 1) : 0,
        });

        if (config.withEvents && firstScanTime) {
          const inKey = buildEventKey([
            "seed",
            student.id,
            "IN",
            firstScanTime.toISOString(),
          ]);
          eventBatch.push({
            eventKey: inKey,
            studentId: student.id,
            schoolId: school.id,
            deviceId: device.id,
            eventType: "IN",
            timestamp: firstScanTime,
            rawPayload: { seed: true, direction: "in" },
          } as any);
          if (lastOutTime) {
            const outKey = buildEventKey([
              "seed",
              student.id,
              "OUT",
              lastOutTime.toISOString(),
            ]);
            eventBatch.push({
              eventKey: outKey,
              studentId: student.id,
              schoolId: school.id,
              deviceId: device.id,
              eventType: "OUT",
              timestamp: lastOutTime,
              rawPayload: { seed: true, direction: "out" },
            } as any);
          }
        }

        if (attendanceBatch.length >= config.batchSize) {
          await prisma.dailyAttendance.createMany({ data: attendanceBatch });
          attendanceBatch.length = 0;
        }
        if (eventBatch.length >= config.batchSize) {
          await prisma.attendanceEvent.createMany({ data: eventBatch });
          eventBatch.length = 0;
        }
      }
    }

    await flushCreateMany(attendanceBatch, (payload) =>
      prisma.dailyAttendance.createMany(payload),
    );
    await flushCreateMany(eventBatch, (payload) =>
      prisma.attendanceEvent.createMany(payload),
    );

    console.log(
      `School #${schoolIndex} done. Students: ${students.length}, days: ${dateList.length}`,
    );
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
