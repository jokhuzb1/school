import { PrismaClient, AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getLocalDateKey, getLocalDateOnly } from "../src/utils/date";
import crypto from "crypto";
import { REAL_CLASSES, REAL_STUDENTS, MALE_FIRST_NAMES, FEMALE_FIRST_NAMES, LAST_NAMES, FATHER_NAMES } from "./real_school_data";

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
  attendanceRate: Number(process.env.SEED_ATTENDANCE_RATE || 0.94),
  lateRate: Number(process.env.SEED_LATE_RATE || 0.05),
  absentRate: Number(process.env.SEED_ABSENT_RATE || 0.003),
  excusedRate: Number(process.env.SEED_EXCUSED_RATE || 0.007),
  withEvents: getEnvBoolean("SEED_WITH_EVENTS", false),
  wipe: getEnvBoolean("SEED_WIPE", false),
  includeBaseSeed: getEnvBoolean("SEED_INCLUDE_BASE", true),
  batchSize: getEnvNumber("SEED_BATCH_SIZE", 1000),
};

const START_TIMES = ["08:00", "09:00", "10:00", "12:00", "14:00"];

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// O'zbek ismini generatsiya qilish
const generateUzbekName = (gender: "MALE" | "FEMALE") => {
  const firstName = gender === "MALE" 
    ? randomItem(MALE_FIRST_NAMES) 
    : randomItem(FEMALE_FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const fatherName = randomItem(FATHER_NAMES);
  
  return {
    firstName,
    lastName,
    fatherName,
    fullName: `${lastName} ${firstName}`,
  };
};

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

async function ensureClass(params: {
  schoolId: string;
  name: string;
  gradeLevel: number;
  startTime: string;
  endTime: string;
}) {
  const existing = await prisma.class.findFirst({
    where: {
      schoolId: params.schoolId,
      name: params.name,
    },
  });

  if (existing) {
    return prisma.class.update({
      where: { id: existing.id },
      data: {
        gradeLevel: params.gradeLevel,
        startTime: params.startTime,
        endTime: params.endTime,
      },
    });
  }

  return prisma.class.create({
    data: {
      schoolId: params.schoolId,
      name: params.name,
      gradeLevel: params.gradeLevel,
      startTime: params.startTime,
      endTime: params.endTime,
    },
  });
}

async function seedRealSchoolData(schoolId: string) {
  console.log("🏫 Seeding real school data (93 classes, ~3,641 students)...");

  // 1. Sinflarni yaratish
  const classMap = new Map<string, string>();
  let classCount = 0;

  for (const cls of REAL_CLASSES) {
    const className = `${cls.grade}${cls.section}`;
    const created = await ensureClass({
      schoolId,
      name: className,
      gradeLevel: cls.grade,
      startTime: "08:00",
      endTime: "14:00",
    });
    classMap.set(className, created.id);
    classCount++;

    if (classCount % 10 === 0) {
      console.log(`  ✓ Created ${classCount}/${REAL_CLASSES.length} classes`);
    }
  }

  console.log(`  ✅ All ${REAL_CLASSES.length} classes created`);

  // 2. O'quvchilarni batch yaratish
  const studentBatch: Array<any> = [];
  let studentCount = 0;
  const batchSize = 500;

  for (const student of REAL_STUDENTS) {
    const classId = classMap.get(student.classKey);
    if (!classId) {
      console.warn(`  ⚠️  Class not found: ${student.classKey}`);
      continue;
    }

    studentCount++;
    studentBatch.push({
      deviceStudentId: `R${studentCount}`,
      lastName: student.lastName,
      firstName: student.firstName,
      fatherName: student.fatherName,
      name: `${student.lastName} ${student.firstName}`,
      gender: student.gender,
      parentPhone: student.phone,
      schoolId,
      classId,
      isActive: true,
    });

    // Batch insert har 500 ta o'quvchidan keyin
    if (studentBatch.length >= batchSize) {
      await prisma.student.createMany({
        data: studentBatch,
        skipDuplicates: true,
      });
      console.log(`  ✓ Inserted ${studentCount}/${REAL_STUDENTS.length} students`);
      studentBatch.length = 0;
    }
  }

  // Qolgan studentlarni insert qilish
  if (studentBatch.length > 0) {
    await prisma.student.createMany({
      data: studentBatch,
      skipDuplicates: true,
    });
  }

  console.log(`  ✅ All ${REAL_STUDENTS.length} students created`);

  // 3. Attendance ma'lumotlarini yaratish
  console.log("  📊 Generating attendance data for real school...");

  // Sinflar uchun start time map
  const classStartMap = new Map<string, { hour: number; minute: number }>();
  for (const cls of REAL_CLASSES) {
    const className = `${cls.grade}${cls.section}`;
    const classId = classMap.get(className);
    if (classId) {
      classStartMap.set(classId, { hour: 8, minute: 0 }); // Default 08:00
    }
  }

  // Device olish yoki yaratish
  const device = await prisma.device.upsert({
    where: { deviceId: "1maktab" },
    update: {},
    create: {
      deviceId: "1maktab",
      name: "1-Maktab Asosiy Kirish",
      schoolId,
      type: "ENTRANCE",
    },
  });

  // Barcha studentlarni olish
  const allStudents = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, classId: true },
  });

  console.log(`  📋 Found ${allStudents.length} students for attendance generation`);

  // Date list yaratish (config'dan)
  const dateList = buildDateList();
  console.log(`  📅 Generating attendance for ${dateList.length} days`);

  const attendanceBatch: Array<any> = [];
  const eventBatch: Array<any> = [];
  const batchLimit = 1000;
  let processedStudents = 0;

  for (const student of allStudents) {
    const classStart = classStartMap.get(student.classId || "") || { hour: 8, minute: 0 };

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
          offsetMinutes = 15 + lateMinutes; // lateThresholdMinutes = 15
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
        schoolId,
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

      // Batch insert
      if (attendanceBatch.length >= batchLimit) {
        await prisma.dailyAttendance.createMany({
          data: attendanceBatch,
          skipDuplicates: true,
        });
        attendanceBatch.length = 0;
      }
    }

    processedStudents++;
    if (processedStudents % 500 === 0) {
      console.log(`  ✓ Processed ${processedStudents}/${allStudents.length} students`);
    }
  }

  // Flush remaining
  if (attendanceBatch.length > 0) {
    await prisma.dailyAttendance.createMany({
      data: attendanceBatch,
      skipDuplicates: true,
    });
  }

  console.log(`  ✅ Attendance data created for ${allStudents.length} students`);
  console.log("🎉 Real school data seeded successfully!");
}

async function seedRealSchoolTeachers(schoolId: string) {
  console.log("👨‍🏫 Seeding real school teachers (93 teacher accounts)...");

  // Har bir sinf uchun teacher user yaratish
  const uniqueTeachers = new Map<string, { name: string; phone: string; classes: string[] }>();

  // Teacher ismini email'ga o'girish
  const nameToEmail = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, ".")
      .replace(/[^a-z.]/g, "")
      + "@school1.uz";
  };

  // Unique teacherlarni topish
  for (const cls of REAL_CLASSES) {
    const className = `${cls.grade}${cls.section}`;
    const teacherKey = `${cls.teacher}_${cls.phone}`;

    if (!uniqueTeachers.has(teacherKey)) {
      uniqueTeachers.set(teacherKey, {
        name: cls.teacher,
        phone: cls.phone,
        classes: [className],
      });
    } else {
      uniqueTeachers.get(teacherKey)!.classes.push(className);
    }
  }

  console.log(`  Found ${uniqueTeachers.size} unique teachers`);

  // Har bir teacher uchun user yaratish
  const password = await bcrypt.hash("teacher123", 10);
  let teacherCount = 0;

  for (const [key, teacher] of uniqueTeachers.entries()) {
    const email = nameToEmail(teacher.name);

    // User mavjudligini tekshirish
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`  ⚠️  Teacher already exists: ${email}`);
      continue;
    }

    // Sinflarning ID'larini topish
    const classes = await prisma.class.findMany({
      where: {
        schoolId,
        name: { in: teacher.classes },
      },
      select: { id: true, name: true },
    });

    if (classes.length === 0) {
      console.warn(`  ⚠️  No classes found for teacher: ${teacher.name}`);
      continue;
    }

    // User yaratish
    const user = await prisma.user.create({
      data: {
        email,
        password,
        name: teacher.name,
        role: "TEACHER",
        schoolId,
        teacherClasses: {
          create: classes.map(cls => ({
            classId: cls.id,
          })),
        },
      },
    });

    teacherCount++;

    if (teacherCount % 10 === 0) {
      console.log(`  ✓ Created ${teacherCount}/${uniqueTeachers.size} teachers`);
    }
  }

  console.log(`  ✅ All ${teacherCount} teachers created`);
  console.log("🎉 Teacher accounts created successfully!");
}


async function main() {
  console.log("Seed config:", config);

  if (config.wipe) {
    console.log("Cleaning database...");
    await prisma.attendanceEvent.deleteMany();
    await prisma.dailyAttendance.deleteMany();
    await prisma.holiday.deleteMany();
    await prisma.provisioningLog.deleteMany();
    await prisma.studentDeviceLink.deleteMany();
    await prisma.studentProvisioning.deleteMany();
    await prisma.student.deleteMany();
    await prisma.device.deleteMany();
    await prisma.teacherClass.deleteMany();
    await prisma.class.deleteMany();
    await prisma.camera.deleteMany();
    await prisma.cameraArea.deleteMany();
    await prisma.nvr.deleteMany();
    await prisma.user.deleteMany();
    await prisma.school.deleteMany();
  }

  const hashed = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@system.com" },
    update: {
      password: hashed,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      schoolId: null,
    },
    create: {
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

    const existingBaseSchool = await prisma.school.findFirst({
      where: { email: "namangan1@maktab.uz" },
    });
    const baseSchool = existingBaseSchool
      ? await prisma.school.update({
          where: { id: existingBaseSchool.id },
          data: {
            schoolNumber: 1,
            name: "Namangan 1-maktab",
            address: "Namangan shahri",
            phone: "+998 69 221 00 01",
            email: "namangan1@maktab.uz",
            lateThresholdMinutes: config.lateThresholdMinutes,
            absenceCutoffMinutes: 180,
            timezone: "Asia/Tashkent",
          },
        })
      : await prisma.school.create({
          data: {
            schoolNumber: 1,
            name: "Namangan 1-maktab",
            address: "Namangan shahri",
            phone: "+998 69 221 00 01",
            email: "namangan1@maktab.uz",
            lateThresholdMinutes: config.lateThresholdMinutes,
            absenceCutoffMinutes: 180,
            timezone: "Asia/Tashkent",
          },
        });

    await prisma.user.upsert({
      where: { email: "school1@admin.com" },
      update: {
        password: hashed,
        name: "1-Maktab Admin",
        role: "SCHOOL_ADMIN",
        schoolId: baseSchool.id,
      },
      create: {
        email: "school1@admin.com",
        password: hashed,
        name: "1-Maktab Admin",
        role: "SCHOOL_ADMIN",
        schoolId: baseSchool.id,
      },
    });

    const baseClass1 = await ensureClass({
      schoolId: baseSchool.id,
      name: "1A",
      gradeLevel: 1,
      startTime: "18:00",
      endTime: "23:00",
    });

    const baseClass2 = await ensureClass({
      schoolId: baseSchool.id,
      name: "8C",
      gradeLevel: 8,
      startTime: "17:00",
      endTime: "22:00",
    });

    await prisma.device.upsert({
      where: { deviceId: "1maktab" },
      update: {
        name: "1-Maktab Asosiy Kirish",
        schoolId: baseSchool.id,
        type: "ENTRANCE",
      },
      create: {
        deviceId: "1maktab",
        name: "1-Maktab Asosiy Kirish",
        schoolId: baseSchool.id,
        type: "ENTRANCE",
      },
    });

    // === Camera system seed data ===
    console.log("📹 Seeding camera system data...");

    // NVR yaratish
    const baseNvr = await prisma.nvr.upsert({
      where: { id: "nvr-1maktab-main" },
      update: {
        name: "1-Maktab Asosiy NVR",
        vendor: "Hikvision",
        model: "DS-7608NI-K2/8P",
        host: "192.168.1.50",
        httpPort: 80,
        onvifPort: 80,
        rtspPort: 554,
        username: "admin",
        passwordEncrypted: "demo123",
        protocol: "ONVIF",
        isActive: true,
      },
      create: {
        id: "nvr-1maktab-main",
        schoolId: baseSchool.id,
        name: "1-Maktab Asosiy NVR",
        vendor: "Hikvision",
        model: "DS-7608NI-K2/8P",
        host: "192.168.1.50",
        httpPort: 80,
        onvifPort: 80,
        rtspPort: 554,
        username: "admin",
        passwordEncrypted: "demo123",
        protocol: "ONVIF",
        isActive: true,
      },
    });

    // Camera Areas yaratish
    const cameraAreas = [
      { id: "area-entrance", name: "Kirish", description: "Asosiy kirish eshigi" },
      { id: "area-corridor-1", name: "1-qavat koridor", description: "Birinchi qavat yo'lagi" },
      { id: "area-corridor-2", name: "2-qavat koridor", description: "Ikkinchi qavat yo'lagi" },
      { id: "area-room-1a", name: "1-A sinf", description: "Birinchi sinf A guruh" },
      { id: "area-room-1b", name: "1-B sinf", description: "Birinchi sinf B guruh" },
      { id: "area-room-2a", name: "2-A sinf", description: "Ikkinchi sinf A guruh" },
      { id: "area-courtyard", name: "Hovli", description: "Maktab hovlisi" },
      { id: "area-lab", name: "Laboratoriya", description: "Kompyuter laboratoriyasi" },
    ];

    for (const area of cameraAreas) {
      await prisma.cameraArea.upsert({
        where: { id: area.id },
        update: {
          name: area.name,
          description: area.description,
          nvrId: baseNvr.id,
        },
        create: {
          id: area.id,
          schoolId: baseSchool.id,
          nvrId: baseNvr.id,
          name: area.name,
          description: area.description,
        },
      });
    }

    // Cameras yaratish
    const cameras = [
      { id: "cam-1", name: "Kirish 1", areaId: "area-entrance", channelNo: 1, status: "ONLINE" as const },
      { id: "cam-2", name: "Kirish 2", areaId: "area-entrance", channelNo: 2, status: "ONLINE" as const },
      { id: "cam-3", name: "1-qavat koridor A", areaId: "area-corridor-1", channelNo: 3, status: "ONLINE" as const },
      { id: "cam-4", name: "1-qavat koridor B", areaId: "area-corridor-1", channelNo: 4, status: "OFFLINE" as const },
      { id: "cam-5", name: "2-qavat koridor", areaId: "area-corridor-2", channelNo: 5, status: "ONLINE" as const },
      { id: "cam-6", name: "1-A sinf", areaId: "area-room-1a", channelNo: 6, status: "ONLINE" as const },
      { id: "cam-7", name: "1-B sinf", areaId: "area-room-1b", channelNo: 7, status: "UNKNOWN" as const },
      { id: "cam-8", name: "2-A sinf", areaId: "area-room-2a", channelNo: 8, status: "ONLINE" as const },
      { id: "cam-9", name: "Hovli 1", areaId: "area-courtyard", channelNo: 9, status: "ONLINE" as const },
      { id: "cam-10", name: "Lab 1", areaId: "area-lab", channelNo: 10, status: "ONLINE" as const },
    ];

    for (const cam of cameras) {
      await prisma.camera.upsert({
        where: { id: cam.id },
        update: {
          name: cam.name,
          areaId: cam.areaId,
          nvrId: baseNvr.id,
          channelNo: cam.channelNo,
          status: cam.status,
          externalId: cam.id,
          streamProfile: "main",
          autoGenerateUrl: true,
          isActive: true,
        },
        create: {
          id: cam.id,
          schoolId: baseSchool.id,
          nvrId: baseNvr.id,
          areaId: cam.areaId,
          name: cam.name,
          externalId: cam.id,
          channelNo: cam.channelNo,
          status: cam.status,
          streamProfile: "main",
          autoGenerateUrl: true,
          isActive: true,
        },
      });
    }

    console.log("  ✅ Camera system seeded: 1 NVR, 8 areas, 10 cameras");

    const baseStudents = [
      {
        lastName: "Mirzaakhmedov",
        firstName: "Jaxongir",
        name: "Mirzaakhmedov Jaxongir",
        gender: "MALE" as const,
        deviceStudentId: "1",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
      {
        lastName: "Mirzaakhmedov",
        firstName: "Mukhammad",
        name: "Mirzaakhmedov Mukhammad",
        gender: "MALE" as const,
        deviceStudentId: "2",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
      {
        lastName: "Dexqonboyev",
        firstName: "Axmadxon",
        name: "Dexqonboyev Axmadxon",
        gender: "MALE" as const,
        deviceStudentId: "484655",
        schoolId: baseSchool.id,
        classId: baseClass2.id,
      },
      {
        lastName: "G'olibjon",
        firstName: "",
        name: "G'olibjon",
        gender: "MALE" as const,
        deviceStudentId: "2302209",
        schoolId: baseSchool.id,
        classId: baseClass2.id,
      },
      {
        lastName: "Abdurazzoqov",
        firstName: "Abduvahob",
        name: "Abdurazzoqov Abduvahob",
        gender: "MALE" as const,
        deviceStudentId: "6",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
      {
        lastName: "Yo'ldoshxo'jayev",
        firstName: "Saidorifxo'ja",
        name: "Yo'ldoshxo'jayev Saidorifxo'ja",
        gender: "MALE" as const,
        deviceStudentId: "456585",
        schoolId: baseSchool.id,
        classId: baseClass2.id,
      },
      {
        lastName: "Sadriddinov",
        firstName: "Ibroxim",
        name: "Sadriddinov Ibroxim",
        gender: "MALE" as const,
        deviceStudentId: "9",
        schoolId: baseSchool.id,
        classId: baseClass1.id,
      },
    ];

    for (const s of baseStudents) {
      await prisma.student.upsert({
        where: {
          schoolId_deviceStudentId: {
            schoolId: s.schoolId,
            deviceStudentId: s.deviceStudentId,
          },
        },
        update: {
          name: s.name,
          firstName: s.firstName,
          lastName: s.lastName,
          classId: s.classId,
          isActive: true,
        },
        create: s,
      });
    }

    console.log("Base seed data created.");

    // Real school ma'lumotlarini qo'shish
    await seedRealSchoolData(baseSchool.id);
    await seedRealSchoolTeachers(baseSchool.id);
  }

  const schoolIndexOffset = config.includeBaseSeed ? 1 : 0;
  for (let schoolIndex = 1; schoolIndex <= config.schools; schoolIndex++) {
    const schoolNumber = schoolIndex + schoolIndexOffset;
    console.log(
      `Creating school ${schoolNumber}/${config.schools + schoolIndexOffset}...`,
    );

    const schoolEmail = `namangan${schoolNumber}@maktab.uz`;
    const existingSchool = await prisma.school.findFirst({
      where: { email: schoolEmail },
    });
    const school = existingSchool
      ? await prisma.school.update({
          where: { id: existingSchool.id },
          data: {
            schoolNumber,
            name: `Namangan ${schoolNumber}-maktab`,
            address: `Namangan shahri, ${schoolNumber}-maktab`,
            phone: `+998 69 221 00 ${schoolNumber.toString().padStart(2, '0')}`,
            email: schoolEmail,
            lateThresholdMinutes: config.lateThresholdMinutes,
            absenceCutoffMinutes: 180,
            timezone: "Asia/Tashkent",
          },
        })
      : await prisma.school.create({
          data: {
            schoolNumber,
            name: `Namangan ${schoolNumber}-maktab`,
            address: `Namangan shahri, ${schoolNumber}-maktab`,
            phone: `+998 69 221 00 ${schoolNumber.toString().padStart(2, '0')}`,
            email: schoolEmail,
            lateThresholdMinutes: config.lateThresholdMinutes,
            absenceCutoffMinutes: 180,
            timezone: "Asia/Tashkent",
          },
        });

    await prisma.user.upsert({
      where: { email: `school${schoolNumber}@admin.com` },
      update: {
        password: hashed,
        name: `School ${schoolNumber} Admin`,
        role: "SCHOOL_ADMIN",
        schoolId: school.id,
      },
      create: {
        email: `school${schoolNumber}@admin.com`,
        password: hashed,
        name: `School ${schoolNumber} Admin`,
        role: "SCHOOL_ADMIN",
        schoolId: school.id,
      },
    });

    const device = await prisma.device.upsert({
      where: { deviceId: `school-${schoolNumber}-entrance` },
      update: {
        name: `School ${schoolNumber} Entrance`,
        schoolId: school.id,
        type: "ENTRANCE",
      },
      create: {
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
      const cls = await ensureClass({
        schoolId: school.id,
        name: `${gradeLevel}${section}`,
        gradeLevel,
        startTime,
        endTime: "15:00",
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
      firstName: string;
      lastName: string;
      gender: "MALE" | "FEMALE";
      deviceStudentId: string;
      schoolId: string;
      classId: string;
      isActive: boolean;
    }> = [];

    let studentCounter = 1;
    for (const cls of classRecords) {
      for (let i = 0; i < config.studentsPerClass; i++) {
        const gender: "MALE" | "FEMALE" = Math.random() > 0.5 ? "MALE" : "FEMALE";
        const { firstName, lastName, fullName } = generateUzbekName(gender);
        studentBatch.push({
          lastName,
          firstName,
          name: fullName,
          gender,
          deviceStudentId: `S${schoolIndex}C${cls.name}N${studentCounter}`,
          schoolId: school.id,
          classId: cls.id,
          isActive: true,
        });
        studentCounter++;

        if (studentBatch.length >= config.batchSize) {
          await prisma.student.createMany({
            data: studentBatch,
            skipDuplicates: true,
          });
          studentBatch.length = 0;
        }
      }
    }
    await flushCreateMany(studentBatch, (payload) =>
      prisma.student.createMany({
        ...payload,
        skipDuplicates: true,
      }),
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
          await prisma.dailyAttendance.createMany({
            data: attendanceBatch,
            skipDuplicates: true,
          });
          attendanceBatch.length = 0;
        }
        if (eventBatch.length >= config.batchSize) {
          await prisma.attendanceEvent.createMany({
            data: eventBatch,
            skipDuplicates: true,
          });
          eventBatch.length = 0;
        }
      }
    }

    await flushCreateMany(attendanceBatch, (payload) =>
      prisma.dailyAttendance.createMany({
        ...payload,
        skipDuplicates: true,
      }),
    );
    await flushCreateMany(eventBatch, (payload) =>
      prisma.attendanceEvent.createMany({
        ...payload,
        skipDuplicates: true,
      }),
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
