import type { Class, LoginResponse, School, User } from "@shared/types";
import { mockClasses, mockSchools, mockUsers } from "../data";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MOCK_DELAY = 200;

export const mockAuthService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    await delay(MOCK_DELAY);
    const userRecord = mockUsers[email];
    if (!userRecord) {
      throw new Error("Foydalanuvchi topilmadi");
    }
    if (userRecord.password !== password) {
      throw new Error("Parol noto'g'ri");
    }
    const token = `mock-token-${Date.now()}`;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userRecord.user));
    return {
      token,
      user: userRecord.user,
    };
  },

  async getMe(): Promise<User> {
    await delay(MOCK_DELAY);
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      throw new Error("Not authenticated");
    }
    return JSON.parse(userStr);
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
};

export const mockSchoolsService = {
  async getAll(): Promise<School[]> {
    await delay(MOCK_DELAY);
    return [...mockSchools];
  },

  async getById(id: string): Promise<School> {
    await delay(MOCK_DELAY);
    const school = mockSchools.find((s) => s.id === id);
    if (!school) throw new Error("School not found");
    return school;
  },

  async create(data: Partial<School>): Promise<School> {
    await delay(MOCK_DELAY);
    const newSchool: School = {
      id: `school-${Date.now()}`,
      name: data.name || "Yangi maktab",
      lateThresholdMinutes: 15,
      absenceCutoffMinutes: 180,
      timezone: "Asia/Tashkent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    mockSchools.push(newSchool);
    return newSchool;
  },

  async update(id: string, data: Partial<School>): Promise<School> {
    await delay(MOCK_DELAY);
    const index = mockSchools.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("School not found");
    mockSchools[index] = {
      ...mockSchools[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return mockSchools[index];
  },

  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockSchools.findIndex((s) => s.id === id);
    if (index !== -1) mockSchools.splice(index, 1);
  },

  async getWebhookInfo(id: string) {
    await delay(MOCK_DELAY);
    return {
      enforceSecret: true,
      secretHeaderName: "X-Webhook-Secret",
      inUrl: `https://api.example.com/webhook/${id}/in`,
      outUrl: `https://api.example.com/webhook/${id}/out`,
      inUrlWithSecret: `https://api.example.com/webhook/${id}/in?secret=xxx`,
      outUrlWithSecret: `https://api.example.com/webhook/${id}/out?secret=xxx`,
      inSecret: "mock-secret-in",
      outSecret: "mock-secret-out",
    };
  },
};

export const mockClassesService = {
  async getAll(schoolId: string): Promise<Class[]> {
    await delay(MOCK_DELAY);
    return mockClasses.filter((c) => c.schoolId === schoolId);
  },

  async create(schoolId: string, data: Partial<Class>): Promise<Class> {
    await delay(MOCK_DELAY);
    const newClass: Class = {
      id: `class-${Date.now()}`,
      name: data.name || "1A",
      gradeLevel: data.gradeLevel || 1,
      schoolId,
      startTime: data.startTime || "08:00",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockClasses.push(newClass);
    return newClass;
  },

  async update(id: string, data: Partial<Class>): Promise<Class> {
    await delay(MOCK_DELAY);
    const index = mockClasses.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Class not found");
    mockClasses[index] = {
      ...mockClasses[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return mockClasses[index];
  },

  async delete(id: string): Promise<void> {
    await delay(MOCK_DELAY);
    const index = mockClasses.findIndex((c) => c.id === id);
    if (index !== -1) mockClasses.splice(index, 1);
  },
};
