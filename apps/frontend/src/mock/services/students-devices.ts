import type {
  AttendanceEvent,
  DailyAttendance,
  Device,
  PeriodType,
  Student,
  StudentsResponse,
} from "@shared/types";
import { mockDevices, mockStudents } from "../data";
import { generateMockAttendance, generateMockEvents } from "../generators";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MOCK_DELAY = 200;

export const mockStudentsService = {
  async getAll(
    schoolId: string,
    params?: { page?: number; limit?: number; search?: string; classId?: string; period?: PeriodType },
  ): Promise<StudentsResponse> {
    await delay(MOCK_DELAY);

    let students = mockStudents.filter((s) => s.schoolId === schoolId);
    if (params?.classId) {
      students = students.filter((s) => s.classId === params.classId);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      students = students.filter((s) => s.name.toLowerCase().includes(q));
    }

    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const start = (page - 1) * limit;
    const paged = students.slice(start, start + limit);
    const stats = {
      total: students.length,
      present: students.filter((s) => s.todayStatus === "PRESENT").length,
      late: students.filter((s) => s.todayStatus === "LATE").length,
      absent: students.filter((s) => s.todayStatus === "ABSENT").length,
      excused: students.filter((s) => s.todayStatus === "EXCUSED").length,
    };

    return {
      data: paged,
      total: students.length,
      page,
      limit,
      period: params?.period || "today",
      periodLabel: "Bugun",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      isSingleDay: true,
      stats,
    };
  },

  async getById(id: string): Promise<Student> {
    await delay(MOCK_DELAY);
    const student = mockStudents.find((s) => s.id === id);
    if (!student) throw new Error("Student not found");
    return student;
  },

  async create(schoolId: string, data: Partial<Student>): Promise<Student> {
    await delay(MOCK_DELAY);
    const newStudent: Student = {
      id: `student-${Date.now()}`,
      name: `${data.lastName || ""} ${data.firstName || ""}`.trim() || "Yangi o'quvchi",
      schoolId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    mockStudents.push(newStudent);
    return newStudent;
  },

  async update(id: string, data: Partial<Student>): Promise<Student> {
    await delay(MOCK_DELAY);
    const index = mockStudents.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("Student not found");
    mockStudents[index] = {
      ...mockStudents[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return mockStudents[index];
  },

  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockStudents.findIndex((s) => s.id === id);
    if (index !== -1) mockStudents.splice(index, 1);
  },

  async getAttendance(id: string, _params?: { month?: string }): Promise<DailyAttendance[]> {
    await delay(MOCK_DELAY);
    const student = mockStudents.find((s) => s.id === id);
    if (!student) return [];
    return generateMockAttendance(student.schoolId).filter((a) => a.studentId === id);
  },

  async getEvents(id: string): Promise<AttendanceEvent[]> {
    await delay(MOCK_DELAY);
    const student = mockStudents.find((s) => s.id === id);
    if (!student) return [];
    return generateMockEvents(student.schoolId, 5).filter((e) => e.studentId === id);
  },

  async importExcel(): Promise<{ imported: number }> {
    await delay(MOCK_DELAY * 3);
    return { imported: 25 };
  },

  async exportExcel(): Promise<Blob> {
    await delay(MOCK_DELAY);
    return new Blob(["Mock Excel Data"], { type: "application/octet-stream" });
  },

  async downloadTemplate(): Promise<Blob> {
    await delay(MOCK_DELAY);
    return new Blob(["Mock Template"], { type: "application/octet-stream" });
  },
};

export const mockDevicesService = {
  async getAll(schoolId: string): Promise<Device[]> {
    await delay(MOCK_DELAY);
    return mockDevices.filter((d) => d.schoolId === schoolId);
  },

  async create(schoolId: string, data: Partial<Device>): Promise<Device> {
    await delay(MOCK_DELAY);
    const newDevice: Device = {
      id: `device-${Date.now()}`,
      name: data.name || "Yangi qurilma",
      deviceId: data.deviceId || `dev-${Date.now()}`,
      schoolId,
      type: data.type || "ENTRANCE",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockDevices.push(newDevice);
    return newDevice;
  },

  async update(id: string, data: Partial<Device>): Promise<Device> {
    await delay(MOCK_DELAY);
    const index = mockDevices.findIndex((d) => d.id === id);
    if (index === -1) throw new Error("Device not found");
    mockDevices[index] = {
      ...mockDevices[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return mockDevices[index];
  },

  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockDevices.findIndex((d) => d.id === id);
    if (index !== -1) mockDevices.splice(index, 1);
  },
};
