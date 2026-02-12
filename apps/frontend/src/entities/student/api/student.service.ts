import { api } from "@shared/api";
import type { AttendanceEvent, DailyAttendance, PeriodType, Student, StudentsResponse } from "@shared/types";
import { isMockMode, mockStudentsService } from "@/mock";

export type { StudentsResponse } from "@shared/types";

export interface StudentsFilters {
  page?: number;
  limit?: number;
  search?: string;
  classId?: string;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
}

export interface ImportStudentsResult {
  imported: number;
  skipped?: number;
  errors?: Array<{ row: number; message: string }>;
}

export const studentsService = {
  async getAll(schoolId: string, params?: StudentsFilters): Promise<StudentsResponse> {
    if (isMockMode()) {
      return mockStudentsService.getAll(schoolId, params);
    }
    const response = await api.get<StudentsResponse>(`/schools/${schoolId}/students`, { params });
    return response.data;
  },

  async getById(id: string): Promise<Student> {
    if (isMockMode()) {
      return mockStudentsService.getById(id);
    }
    const response = await api.get<Student>(`/students/${id}`);
    return response.data;
  },

  async create(schoolId: string, data: Partial<Student>): Promise<Student> {
    if (isMockMode()) {
      return mockStudentsService.create(schoolId, data);
    }
    const response = await api.post<Student>(`/schools/${schoolId}/students`, data);
    return response.data;
  },

  async update(id: string, data: Partial<Student>): Promise<Student> {
    if (isMockMode()) {
      return mockStudentsService.update(id, data);
    }
    const response = await api.put<Student>(`/students/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    if (isMockMode()) {
      return mockStudentsService.delete(id);
    }
    await api.delete(`/students/${id}`);
  },

  async getAttendance(id: string, params?: { month?: string }): Promise<DailyAttendance[]> {
    if (isMockMode()) {
      return mockStudentsService.getAttendance(id, params);
    }
    const response = await api.get<DailyAttendance[]>(`/students/${id}/attendance`, { params });
    return response.data;
  },

  async getEvents(id: string, params?: { date?: string }): Promise<AttendanceEvent[]> {
    if (isMockMode()) {
      return mockStudentsService.getEvents(id);
    }
    const response = await api.get<AttendanceEvent[]>(`/students/${id}/events`, { params });
    return response.data;
  },

  async importExcel(
    schoolId: string,
    file: File,
    options?: { createMissingClass?: boolean },
  ): Promise<ImportStudentsResult> {
    if (isMockMode()) {
      return mockStudentsService.importExcel();
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/schools/${schoolId}/students/import`, formData, {
      params: options?.createMissingClass ? { createMissingClass: "true" } : undefined,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async exportExcel(schoolId: string): Promise<Blob> {
    if (isMockMode()) {
      return mockStudentsService.exportExcel();
    }
    const response = await api.get(`/schools/${schoolId}/students/export`, { responseType: "blob" });
    return response.data;
  },

  async downloadTemplate(schoolId: string): Promise<Blob> {
    if (isMockMode()) {
      return mockStudentsService.downloadTemplate();
    }
    const response = await api.get(`/schools/${schoolId}/students/template`, { responseType: "blob" });
    return response.data;
  },
};

