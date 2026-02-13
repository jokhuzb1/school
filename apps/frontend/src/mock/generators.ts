import type { AttendanceEvent, DailyAttendance, DashboardStats } from "@shared/types";
import { mockClasses, mockDevices, mockStudents } from "./data";

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const now = new Date().toISOString();

export function generateMockAttendance(
  schoolId: string,
  classId?: string,
): DailyAttendance[] {
  const today = new Date().toISOString().split("T")[0];
  const students = mockStudents.filter(
    (s) => s.schoolId === schoolId && (!classId || s.classId === classId),
  );

  return students.map((student) => ({
    id: `attendance-${student.id}-${today}`,
    studentId: student.id,
    student,
    schoolId,
    date: today,
    status: student.todayEffectiveStatus || "PRESENT",
    firstScanTime: student.todayFirstScan || undefined,
    lastScanTime: student.todayFirstScan || undefined,
    lateMinutes: student.todayStatus === "LATE" ? randomInt(1, 30) : undefined,
    currentlyInSchool:
      student.todayStatus === "PRESENT" || student.todayStatus === "LATE",
    scanCount:
      student.todayStatus === "PRESENT" || student.todayStatus === "LATE"
        ? randomInt(1, 4)
        : 0,
    createdAt: now,
    updatedAt: now,
  }));
}

export function generateMockDashboardStats(
  schoolId: string,
  classId?: string,
): DashboardStats {
  const students = mockStudents.filter(
    (s) => s.schoolId === schoolId && (!classId || s.classId === classId),
  );
  const total = students.length;
  const present = students.filter((s) => s.todayStatus === "PRESENT").length;
  const late = students.filter((s) => s.todayStatus === "LATE").length;
  const absent = students.filter((s) => s.todayStatus === "ABSENT").length;
  const excused = students.filter((s) => s.todayStatus === "EXCUSED").length;
  const classes = mockClasses.filter((c) => c.schoolId === schoolId);

  return {
    period: "today",
    periodLabel: "Bugun",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    daysCount: 1,
    totalStudents: total,
    presentToday: present,
    lateToday: late,
    absentToday: absent,
    excusedToday: excused,
    presentPercentage: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
    currentlyInSchool: present + late,
    classBreakdown: classes.slice(0, 10).map((c) => ({
      classId: c.id,
      className: c.name,
      total: c.totalStudents || 30,
      present: c.todayPresent || 25,
      late: c.todayLate || 2,
    })),
    weeklyStats: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayNames = [
        "Yakshanba",
        "Dushanba",
        "Seshanba",
        "Chorshanba",
        "Payshanba",
        "Juma",
        "Shanba",
      ];
      return {
        date: d.toISOString().split("T")[0],
        dayName: dayNames[d.getDay()],
        present: randomInt(180, 220),
        late: randomInt(10, 25),
        absent: randomInt(5, 15),
      };
    }).reverse(),
    notYetArrived: students
      .filter((s) => !s.todayFirstScan)
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.name,
        className: s.class?.name || "",
        pendingStatus: "PENDING_EARLY" as const,
      })),
    notYetArrivedCount: students.filter((s) => !s.todayFirstScan).length,
  };
}

export function generateMockEvents(
  schoolId: string,
  limit = 10,
): AttendanceEvent[] {
  const students = mockStudents.filter((s) => s.schoolId === schoolId).slice(0, limit);
  const devices = mockDevices.filter((d) => d.schoolId === schoolId);

  return students.map((student, i) => ({
    id: `event-${student.id}-${Date.now()}-${i}`,
    studentId: student.id,
    student,
    schoolId,
    deviceId: devices[0]?.id,
    device: devices[0],
    eventType: i % 2 === 0 ? "IN" : "OUT",
    timestamp: new Date(Date.now() - i * 60000 * randomInt(1, 10)).toISOString(),
    rawPayload: {},
    createdAt: now,
  }));
}

export function getMockSchoolUsers(_schoolId: string) {
  return [
    {
      id: "user-t1",
      name: "Kambarova D A",
      email: "kambarova@school.uz",
      role: "TEACHER" as const,
      createdAt: now,
    },
    {
      id: "user-t2",
      name: "Alisheva X M",
      email: "alisheva@school.uz",
      role: "TEACHER" as const,
      createdAt: now,
    },
    {
      id: "user-g1",
      name: "Sodiqov B",
      email: "sodiqov@school.uz",
      role: "GUARD" as const,
      createdAt: now,
    },
  ];
}
