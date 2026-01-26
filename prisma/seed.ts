import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database...");
  await prisma.attendanceEvent.deleteMany();
  await prisma.dailyAttendance.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.student.deleteMany();
  await prisma.device.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  const hashed = await bcrypt.hash("admin123", 10);
  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@system.com",
      password: hashed,
      name: "Super Admin",
      role: "SUPER_ADMIN",
    },
  });

  const school = await prisma.school.create({
    data: {
      name: "School #1",
      address: "123 Main St",
      phone: "123456789",
      email: "school1@example.com",
    },
  });

  // School #1 Admin
  const schoolAdmin = await prisma.user.create({
    data: {
      email: "school1@admin.com",
      password: hashed,
      name: "1-Maktab Admin",
      role: "SCHOOL_ADMIN",
      schoolId: school.id,
    },
  });

  const class1 = await prisma.class.create({
    data: {
      name: "1A",
      gradeLevel: 1,
      schoolId: school.id,
      startTime: "08:00",
      endTime: "12:00",
    },
  });

  const class2 = await prisma.class.create({
    data: {
      name: "8C",
      gradeLevel: 8,
      schoolId: school.id,
      startTime: "12:00",
      endTime: "15:00",
    },
  });

  const students = [
    {
      name: "Alice",
      deviceStudentId: "1",
      schoolId: school.id,
      classId: class1.id,
    },
    {
      name: "Bob",
      deviceStudentId: "2",
      schoolId: school.id,
      classId: class1.id,
    },
    {
      name: "Charlie",
      deviceStudentId: "3",
      schoolId: school.id,
      classId: class2.id,
    },
    {
      name: "G'olibjon",
      deviceStudentId: "2302209",
      schoolId: school.id,
      classId: class2.id,
    },
  ];

  for (const s of students) {
    await prisma.student.create({ data: s as any });
    console.log(`Created student: ${s.name}`);
  }

  await prisma.device.create({
    data: {
      deviceId: "1maktab",
      name: "1-Maktab Asosiy Kirish",
      schoolId: school.id,
      type: "ENTRANCE",
    },
  });

  // Oxirgi 2 haftalik attendance ma'lumotlari
  console.log("Creating attendance data for last 2 weeks...");
  
  const allStudents = await prisma.student.findMany();
  const today = new Date();
  
  for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);
    
    // Dam olish kunlarini o'tkazib yuborish (Shanba=6, Yakshanba=0)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    for (const student of allStudents) {
      // Tasodifiy holat generatsiya qilish
      const rand = Math.random();
      let status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
      let firstScanTime: Date | null = null;
      let lastOutTime: Date | null = null;
      let lateMinutes: number | null = null;
      let totalTimeOnPremises: number | null = null;
      
      if (rand < 0.7) {
        // 70% - O'z vaqtida kelgan
        status = "PRESENT";
        firstScanTime = new Date(date);
        firstScanTime.setHours(7, 30 + Math.floor(Math.random() * 25), Math.floor(Math.random() * 60));
        
        lastOutTime = new Date(date);
        lastOutTime.setHours(14 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
        
        totalTimeOnPremises = Math.round((lastOutTime.getTime() - firstScanTime.getTime()) / 60000);
      } else if (rand < 0.85) {
        // 15% - Kech qolgan
        status = "LATE";
        firstScanTime = new Date(date);
        firstScanTime.setHours(8, 15 + Math.floor(Math.random() * 45), Math.floor(Math.random() * 60));
        lateMinutes = Math.floor(Math.random() * 30) + 5;
        
        lastOutTime = new Date(date);
        lastOutTime.setHours(14 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
        
        totalTimeOnPremises = Math.round((lastOutTime.getTime() - firstScanTime.getTime()) / 60000);
      } else if (rand < 0.95) {
        // 10% - Kelmagan
        status = "ABSENT";
      } else {
        // 5% - Sababli
        status = "EXCUSED";
      }
      
      await prisma.dailyAttendance.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          date: date,
          status,
          firstScanTime,
          lastScanTime: lastOutTime || firstScanTime,
          lastInTime: firstScanTime,
          lastOutTime,
          lateMinutes,
          totalTimeOnPremises,
          currentlyInSchool: false,
          scanCount: firstScanTime ? 2 : 0,
        },
      });
    }
    console.log(`Created attendance for ${date.toLocaleDateString()}`);
  }

  console.log("Seed completed: All data wiped and re-created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
