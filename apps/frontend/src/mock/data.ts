/**
 * Mock Data - Frontend
 * Bu fayl asosiy mock datasetlarni saqlaydi.
 */

import type {
  Class,
  Device,
  Holiday,
  School,
  Student,
  User,
} from "@shared/types";

const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const MALE_FIRST_NAMES = [
  "Akmal",
  "Aziz",
  "Bobur",
  "Jasur",
  "Doston",
  "Diyor",
  "Sanjarbek",
  "Farxod",
  "Umid",
  "Otabek",
  "Shoxrux",
  "Jamshid",
  "Norbek",
  "Temur",
  "Komil",
  "Anvar",
  "Sherzod",
  "Farrux",
  "Erkin",
  "Bahrom",
  "Nodir",
  "Sardor",
  "Jahongir",
  "Muhammad",
];

const FEMALE_FIRST_NAMES = [
  "Gulnora",
  "Nilufar",
  "Shahnoza",
  "Mohira",
  "Dilnoza",
  "Nigora",
  "Zulfiya",
  "Malika",
  "Dildora",
  "Farangiz",
  "Sevara",
  "Gulbahor",
  "Ozoda",
  "Madina",
  "Sabina",
  "Dilafruz",
  "Gulchehra",
  "Nozima",
  "Sarvinoz",
  "Yulduz",
];

const LAST_NAMES = [
  "Toshev",
  "Aliev",
  "Karimov",
  "Rahimov",
  "Usmanov",
  "Yusupov",
  "Mirzayev",
  "Ahmedov",
  "Xolmatov",
  "Abdullayev",
  "Ismoilov",
  "Saidov",
  "Sharipov",
  "Hasanov",
  "Azimov",
  "Boboyev",
  "Norov",
  "Qosimov",
  "Aminov",
  "Valiyev",
];

const FATHER_NAMES = [
  "Abdulla",
  "Akbar",
  "Alisher",
  "Anvar",
  "Aziz",
  "Bahrom",
  "Jasur",
  "Kamol",
  "Latif",
  "Mansur",
  "Nodir",
  "Otabek",
  "Rashid",
  "Salim",
  "Temur",
  "Umid",
];

const now = new Date().toISOString();

export const mockUsers: Record<string, { user: User; password: string }> = {
  "admin@system.com": {
    password: "admin123",
    user: {
      id: "user-admin",
      email: "admin@system.com",
      name: "Super Admin",
      role: "SUPER_ADMIN",
      createdAt: now,
      updatedAt: now,
    },
  },
  "school1@admin.com": {
    password: "admin123",
    user: {
      id: "user-school1",
      email: "school1@admin.com",
      name: "1-Maktab Admin",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
      createdAt: now,
      updatedAt: now,
    },
  },
  "teacher@school1.uz": {
    password: "teacher123",
    user: {
      id: "user-teacher1",
      email: "teacher@school1.uz",
      name: "Kambarova D A",
      role: "TEACHER",
      schoolId: "school-1",
      createdAt: now,
      updatedAt: now,
    },
  },
};

export const mockSchools: School[] = Array.from({ length: 10 }, (_, i) => ({
  id: `school-${i + 1}`,
  name: `Namangan ${i + 1}-maktab`,
  address: `Namangan shahri, ${i + 1}-mavze`,
  phone: `+998 69 221 00 ${String(i + 1).padStart(2, "0")}`,
  email: `namangan${i + 1}@maktab.uz`,
  lateThresholdMinutes: 15,
  absenceCutoffMinutes: 180,
  timezone: "Asia/Tashkent",
  createdAt: now,
  updatedAt: now,
  _count: {
    students: randomInt(200, 500),
    classes: 6 + i,
    devices: 2,
  },
  todayStats: {
    present: randomInt(150, 400),
    late: randomInt(10, 30),
    absent: randomInt(5, 20),
    excused: randomInt(2, 10),
    attendancePercent: randomInt(85, 98),
  },
}));

const CLASS_SECTIONS = ["A", "B", "V", "G", "D", "E"];

export const mockClasses: Class[] = [];
mockSchools.forEach((school) => {
  for (let grade = 1; grade <= 11; grade++) {
    const sectionsCount = grade <= 4 ? 4 : grade <= 7 ? 3 : 2;
    for (let s = 0; s < sectionsCount; s++) {
      mockClasses.push({
        id: `class-${school.id}-${grade}${CLASS_SECTIONS[s]}`,
        name: `${grade}${CLASS_SECTIONS[s]}`,
        gradeLevel: grade,
        schoolId: school.id,
        startTime: "08:00",
        endTime: "14:00",
        createdAt: now,
        updatedAt: now,
        _count: { students: randomInt(25, 45) },
        todayPresent: randomInt(20, 40),
        todayLate: randomInt(1, 5),
        todayAbsent: randomInt(0, 3),
        totalStudents: randomInt(30, 45),
      });
    }
  }
});

export const mockStudents: Student[] = [];
let studentCounter = 0;

mockClasses.forEach((cls) => {
  const studentCount = cls._count?.students || 30;
  for (let i = 0; i < studentCount; i++) {
    studentCounter++;
    const gender = Math.random() > 0.5 ? "MALE" : "FEMALE";
    const firstName =
      gender === "MALE" ? randomItem(MALE_FIRST_NAMES) : randomItem(FEMALE_FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const fatherName = randomItem(FATHER_NAMES);
    const statuses: Array<"PRESENT" | "LATE" | "ABSENT" | "EXCUSED"> = [
      "PRESENT",
      "PRESENT",
      "PRESENT",
      "PRESENT",
      "LATE",
      "ABSENT",
      "EXCUSED",
    ];
    const todayStatus = randomItem(statuses);

    mockStudents.push({
      id: `student-${studentCounter}`,
      deviceStudentId: String(studentCounter),
      name: `${lastName} ${firstName}`,
      firstName,
      lastName,
      fatherName,
      gender,
      schoolId: cls.schoolId,
      classId: cls.id,
      class: cls,
      parentPhone: `+998 9${randomInt(0, 9)} ${randomInt(100, 999)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
      photoUrl: undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      todayStatus,
      todayEffectiveStatus: todayStatus,
      todayFirstScan:
        todayStatus === "PRESENT" || todayStatus === "LATE"
          ? new Date(new Date().setHours(8, randomInt(0, 30), 0, 0)).toISOString()
          : null,
    });
  }
});

export const mockDevices: Device[] = [];
mockSchools.forEach((school) => {
  mockDevices.push(
    {
      id: `device-${school.id}-entrance`,
      name: `${school.name} Asosiy Kirish`,
      deviceId: `${school.id}-entrance`,
      schoolId: school.id,
      type: "ENTRANCE",
      location: "Asosiy darvoza",
      isActive: true,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `device-${school.id}-exit`,
      name: `${school.name} Chiqish`,
      deviceId: `${school.id}-exit`,
      schoolId: school.id,
      type: "EXIT",
      location: "Orqa darvoza",
      isActive: true,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    },
  );
});

export const mockHolidays: Holiday[] = [
  { id: "holiday-1", schoolId: "school-1", date: "2026-01-01", name: "Yangi yil", createdAt: now },
  { id: "holiday-2", schoolId: "school-1", date: "2026-03-08", name: "Xotin-qizlar kuni", createdAt: now },
  { id: "holiday-3", schoolId: "school-1", date: "2026-03-21", name: "Navro'z", createdAt: now },
  { id: "holiday-4", schoolId: "school-1", date: "2026-05-09", name: "Xotira va qadrlash kuni", createdAt: now },
  { id: "holiday-5", schoolId: "school-1", date: "2026-09-01", name: "Mustaqillik kuni", createdAt: now },
];
