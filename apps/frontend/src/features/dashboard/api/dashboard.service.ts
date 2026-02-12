import { api } from "@shared/api";
import type { AttendanceEvent, AttendanceScope, DashboardStats, PeriodType } from "@shared/types";
import { isMockMode, mockDashboardService } from "@/mock";

export type { PeriodType } from "@shared/types";

export interface DashboardFilters {
  classId?: string;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
  scope?: AttendanceScope;
}

export const dashboardService = {
  async getStats(schoolId: string, filters?: DashboardFilters): Promise<DashboardStats> {
    if (isMockMode()) {
      return mockDashboardService.getStats(schoolId, filters);
    }
    const params: Record<string, string> = {};
    if (filters?.classId) params.classId = filters.classId;
    if (filters?.period) params.period = filters.period;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.scope) params.scope = filters.scope;

    const response = await api.get<DashboardStats>(`/schools/${schoolId}/dashboard`, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data;
  },

  async getAdminStats(filters?: {
    period?: PeriodType;
    startDate?: string;
    endDate?: string;
    scope?: AttendanceScope;
  }): Promise<any> {
    if (isMockMode()) {
      return mockDashboardService.getAdminStats();
    }
    const params: Record<string, string> = {};
    if (filters?.period) params.period = filters.period;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.scope) params.scope = filters.scope;
    const response = await api.get("/admin/dashboard", {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data;
  },

  async getRecentEvents(schoolId: string, limit = 10): Promise<AttendanceEvent[]> {
    if (isMockMode()) {
      return mockDashboardService.getRecentEvents(schoolId, limit);
    }
    const response = await api.get<AttendanceEvent[]>(`/schools/${schoolId}/events`, { params: { limit } });
    return response.data;
  },

  async getEventHistory(
    schoolId: string,
    params: { startDate: string; endDate: string; limit?: number; classId?: string },
  ): Promise<{ data: AttendanceEvent[]; timezone: string; startDate: string; endDate: string }> {
    if (isMockMode()) {
      return mockDashboardService.getEventHistory(schoolId, params);
    }
    const response = await api.get(`/schools/${schoolId}/events/history`, { params });
    return response.data;
  },
};

