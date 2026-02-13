import { api } from "@shared/api";
import { isMockMode, mockUsersService } from "@/mock";

export type UserRole = "TEACHER" | "GUARD";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface TeacherClass {
  id: string;
  name: string;
  gradeLevel: number;
}

export const usersService = {
  async getAll(schoolId: string): Promise<User[]> {
    if (isMockMode()) {
      return mockUsersService.getAll(schoolId) as Promise<User[]>;
    }
    const res = await api.get(`/schools/${schoolId}/users`);
    return res.data;
  },

  async create(schoolId: string, data: CreateUserData): Promise<User> {
    if (isMockMode()) {
      return mockUsersService.create(schoolId, data) as Promise<User>;
    }
    const res = await api.post(`/schools/${schoolId}/users`, data);
    return res.data;
  },

  async delete(schoolId: string, userId: string): Promise<void> {
    if (isMockMode()) {
      return mockUsersService.delete();
    }
    await api.delete(`/schools/${schoolId}/users/${userId}`);
  },

  async update(
    schoolId: string,
    userId: string,
    data: { name?: string; password?: string },
  ): Promise<User> {
    if (isMockMode()) {
      return mockUsersService.update(schoolId, userId, data) as Promise<User>;
    }
    const res = await api.put(`/schools/${schoolId}/users/${userId}`, data);
    return res.data;
  },

  async getTeacherClasses(schoolId: string, teacherId: string): Promise<TeacherClass[]> {
    if (isMockMode()) {
      return mockUsersService.getTeacherClasses(schoolId) as Promise<TeacherClass[]>;
    }
    const res = await api.get(`/schools/${schoolId}/teachers/${teacherId}/classes`);
    return res.data;
  },

  async assignClass(schoolId: string, teacherId: string, classId: string): Promise<void> {
    if (isMockMode()) {
      return mockUsersService.assignClass();
    }
    await api.post(`/schools/${schoolId}/teachers/${teacherId}/classes`, { classId });
  },

  async unassignClass(schoolId: string, teacherId: string, classId: string): Promise<void> {
    if (isMockMode()) {
      return mockUsersService.unassignClass();
    }
    await api.delete(`/schools/${schoolId}/teachers/${teacherId}/classes/${classId}`);
  },
};

