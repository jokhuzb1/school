import api from "./api";
import type { DailyAttendance } from "../types";

export const attendanceService = {
  async getToday(
    schoolId: string,
    params?: { classId?: string; status?: string },
  ): Promise<DailyAttendance[]> {
    const response = await api.get<DailyAttendance[]>(
      `/schools/${schoolId}/attendance/today`,
      { params },
    );
    return response.data;
  },

  async getReport(
    schoolId: string,
    params: { startDate: string; endDate: string; classId?: string },
  ): Promise<DailyAttendance[]> {
    const response = await api.get<DailyAttendance[]>(
      `/schools/${schoolId}/attendance/report`,
      { params },
    );
    return response.data;
  },

  async update(
    id: string,
    data: Partial<DailyAttendance>,
  ): Promise<DailyAttendance> {
    const response = await api.put<DailyAttendance>(`/attendance/${id}`, data);
    return response.data;
  },

  async exportExcel(
    schoolId: string,
    params: { startDate: string; endDate: string },
  ): Promise<Blob> {
    const response = await api.post(
      `/schools/${schoolId}/attendance/export`,
      params,
      {
        responseType: "blob",
      },
    );
    return response.data;
  },

  async bulkUpdate(
    ids: string[],
    status: string,
    notes?: string,
  ): Promise<{ updated: number }> {
    const response = await api.put<{ updated: number }>("/attendance/bulk", {
      ids,
      status,
      notes,
    });
    return response.data;
  },

  async upsert(
    schoolId: string,
    data: { studentId: string; date: string; status: string; notes?: string },
  ): Promise<DailyAttendance> {
    const response = await api.post<DailyAttendance>(
      `/schools/${schoolId}/attendance/upsert`,
      data,
    );
    return response.data;
  },
};
