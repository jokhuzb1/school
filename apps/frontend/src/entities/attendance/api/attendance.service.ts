import { api } from "@shared/api";
import type { DailyAttendance } from "@shared/types";
import { isMockMode, mockAttendanceService } from "@/mock";

export const attendanceService = {
  async getToday(
    schoolId: string,
    params?: { classId?: string; status?: string },
  ): Promise<DailyAttendance[]> {
    if (isMockMode()) {
      return mockAttendanceService.getToday(schoolId, params);
    }
    const response = await api.get<DailyAttendance[]>(`/schools/${schoolId}/attendance/today`, { params });
    return response.data;
  },

  async getReport(
    schoolId: string,
    params: { startDate: string; endDate: string; classId?: string },
  ): Promise<DailyAttendance[]> {
    if (isMockMode()) {
      return mockAttendanceService.getReport(schoolId, params);
    }
    const response = await api.get<DailyAttendance[]>(`/schools/${schoolId}/attendance/report`, { params });
    return response.data;
  },

  async update(id: string, data: Partial<DailyAttendance>): Promise<DailyAttendance> {
    if (isMockMode()) {
      return mockAttendanceService.update(id, data);
    }
    const response = await api.put<DailyAttendance>(`/attendance/${id}`, data);
    return response.data;
  },

  async exportExcel(schoolId: string, params: { startDate: string; endDate: string }): Promise<Blob> {
    if (isMockMode()) {
      return mockAttendanceService.exportExcel();
    }
    const response = await api.post(`/schools/${schoolId}/attendance/export`, params, { responseType: "blob" });
    return response.data;
  },

  async bulkUpdate(ids: string[], status: string, notes?: string): Promise<{ updated: number }> {
    if (isMockMode()) {
      return mockAttendanceService.bulkUpdate(ids, status);
    }
    const response = await api.put<{ updated: number }>("/attendance/bulk", { ids, status, notes });
    return response.data;
  },

  async upsert(
    schoolId: string,
    data: { studentId: string; date: string; status: string; notes?: string },
  ): Promise<DailyAttendance> {
    if (isMockMode()) {
      return mockAttendanceService.upsert(schoolId, data) as Promise<DailyAttendance>;
    }
    const response = await api.post<DailyAttendance>(`/schools/${schoolId}/attendance/upsert`, data);
    return response.data;
  },
};

