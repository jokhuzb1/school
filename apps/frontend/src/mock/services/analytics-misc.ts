import type {
  AttendanceEvent,
  DailyAttendance,
  DashboardStats,
  Holiday,
} from "@shared/types";
import { mockClasses, mockHolidays, mockSchools, mockStudents } from "../data";
import {
  generateMockAttendance,
  generateMockDashboardStats,
  generateMockEvents,
  getMockSchoolUsers,
} from "../generators";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MOCK_DELAY = 200;

export const mockDashboardService = {
  async getStats(schoolId: string, filters?: { classId?: string }): Promise<DashboardStats> {
    await delay(MOCK_DELAY);
    return generateMockDashboardStats(schoolId, filters?.classId);
  },

  async getAdminStats(): Promise<any> {
    await delay(MOCK_DELAY);

    const schoolsData = mockSchools.map((s) => {
      const schoolStudents = mockStudents.filter((st) => st.schoolId === s.id);
      const present = schoolStudents.filter((st) => st.todayStatus === "PRESENT").length;
      const late = schoolStudents.filter((st) => st.todayStatus === "LATE").length;
      const absent = schoolStudents.filter((st) => st.todayStatus === "ABSENT").length;
      const excused = schoolStudents.filter((st) => st.todayStatus === "EXCUSED").length;
      const total = schoolStudents.length;

      return {
        id: s.id,
        name: s.name,
        address: s.address || "",
        totalStudents: total,
        totalClasses: s._count?.classes || 0,
        totalDevices: s._count?.devices || 0,
        presentToday: present,
        lateToday: late,
        absentToday: absent,
        excusedToday: excused,
        pendingEarlyCount: 0,
        latePendingCount: 0,
        currentlyInSchool: present + late,
        attendancePercent: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      };
    });

    const totals = schoolsData.reduce(
      (acc, school) => ({
        totalSchools: acc.totalSchools + 1,
        totalStudents: acc.totalStudents + school.totalStudents,
        presentToday: acc.presentToday + school.presentToday,
        lateToday: acc.lateToday + school.lateToday,
        absentToday: acc.absentToday + school.absentToday,
        excusedToday: acc.excusedToday + school.excusedToday,
        pendingEarlyCount: acc.pendingEarlyCount + school.pendingEarlyCount,
        latePendingCount: acc.latePendingCount + school.latePendingCount,
        currentlyInSchool: acc.currentlyInSchool + school.currentlyInSchool,
        attendancePercent: 0,
      }),
      {
        totalSchools: 0,
        totalStudents: 0,
        presentToday: 0,
        lateToday: 0,
        absentToday: 0,
        excusedToday: 0,
        pendingEarlyCount: 0,
        latePendingCount: 0,
        currentlyInSchool: 0,
        attendancePercent: 0,
      },
    );

    totals.attendancePercent =
      totals.totalStudents > 0
        ? Math.round(((totals.presentToday + totals.lateToday) / totals.totalStudents) * 100)
        : 0;

    const weeklyStats = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
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
        present: Math.floor(totals.presentToday * (0.9 + Math.random() * 0.2)),
        late: Math.floor(totals.lateToday * (0.8 + Math.random() * 0.4)),
        absent: Math.floor(totals.absentToday * (0.8 + Math.random() * 0.4)),
      };
    });

    return {
      totals,
      schools: schoolsData,
      recentEvents: [],
      weeklyStats,
    };
  },

  async getRecentEvents(schoolId: string, limit = 10): Promise<AttendanceEvent[]> {
    await delay(MOCK_DELAY);
    return generateMockEvents(schoolId, limit);
  },

  async getEventHistory(schoolId: string, params: { startDate: string; endDate: string }) {
    await delay(MOCK_DELAY);
    return {
      data: generateMockEvents(schoolId, 50),
      timezone: "Asia/Tashkent",
      startDate: params.startDate,
      endDate: params.endDate,
    };
  },
};

export const mockAttendanceService = {
  async getToday(schoolId: string, params?: { classId?: string }): Promise<DailyAttendance[]> {
    await delay(MOCK_DELAY);
    return generateMockAttendance(schoolId, params?.classId);
  },

  async getReport(schoolId: string, params: { classId?: string }): Promise<DailyAttendance[]> {
    await delay(MOCK_DELAY);
    return generateMockAttendance(schoolId, params.classId);
  },

  async update(id: string, data: Partial<DailyAttendance>): Promise<DailyAttendance> {
    await delay(MOCK_DELAY);
    const attendance = generateMockAttendance("school-1")[0];
    return { ...attendance, ...data, id };
  },

  async exportExcel(): Promise<Blob> {
    await delay(MOCK_DELAY);
    return new Blob(["Mock Attendance Report"], { type: "application/octet-stream" });
  },

  async bulkUpdate(ids: string[], _status: string): Promise<{ updated: number }> {
    await delay(MOCK_DELAY);
    return { updated: ids.length };
  },

  async upsert(schoolId: string, data: { studentId: string; date: string; status: string }) {
    await delay(MOCK_DELAY);
    return {
      id: `attendance-${Date.now()}`,
      ...data,
      schoolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};

export const mockHolidaysService = {
  async getAll(schoolId: string): Promise<Holiday[]> {
    await delay(MOCK_DELAY);
    return mockHolidays.filter((h) => h.schoolId === schoolId || h.schoolId === "school-1");
  },

  async create(schoolId: string, data: Partial<Holiday>): Promise<Holiday> {
    await delay(MOCK_DELAY);
    const newHoliday: Holiday = {
      id: `holiday-${Date.now()}`,
      schoolId,
      date: data.date || new Date().toISOString().split("T")[0],
      name: data.name || "Yangi bayram",
      createdAt: new Date().toISOString(),
    };
    mockHolidays.push(newHoliday);
    return newHoliday;
  },

  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockHolidays.findIndex((h) => h.id === id);
    if (index !== -1) mockHolidays.splice(index, 1);
  },
};

export const mockUsersService = {
  async getAll(schoolId: string) {
    await delay(MOCK_DELAY);
    return getMockSchoolUsers(schoolId);
  },

  async create(_schoolId: string, data: { name: string; email: string; role: string }) {
    await delay(MOCK_DELAY);
    return { id: `user-${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  },

  async delete(): Promise<void> {
    await delay(MOCK_DELAY);
  },

  async update(_schoolId: string, userId: string, data: { name?: string }) {
    await delay(MOCK_DELAY);
    return { id: userId, ...data, createdAt: new Date().toISOString() };
  },

  async getTeacherClasses(schoolId: string) {
    await delay(MOCK_DELAY);
    return mockClasses.filter((c) => c.schoolId === schoolId).slice(0, 3);
  },

  async assignClass(): Promise<void> {
    await delay(MOCK_DELAY);
  },

  async unassignClass(): Promise<void> {
    await delay(MOCK_DELAY);
  },
};

export const mockSearchService = {
  async search(schoolId: string, query: string) {
    await delay(MOCK_DELAY);
    if (!query) return [];

    const q = query.toLowerCase();
    const students = mockStudents
      .filter((s) => s.schoolId === schoolId && s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.class?.name,
        route: `/students/${s.id}`,
      }));

    const classes = mockClasses
      .filter((c) => c.schoolId === schoolId && c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.gradeLevel}-sinf`,
        route: `/classes/${c.id}`,
      }));

    return [
      { key: "students", label: "O'quvchilar", items: students },
      { key: "classes", label: "Sinflar", items: classes },
    ];
  },
};
