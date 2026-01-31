import api from './api';
import type { DashboardStats, AttendanceEvent, PeriodType, AttendanceScope } from '../types';

// Re-export PeriodType for convenience
export type { PeriodType } from '../types';

export interface DashboardFilters {
    classId?: string;
    period?: PeriodType;
    startDate?: string;
    endDate?: string;
    scope?: AttendanceScope;
}

export const dashboardService = {
    async getStats(schoolId: string, filters?: DashboardFilters): Promise<DashboardStats> {
        const params: Record<string, string> = {};
        
        if (filters?.classId) params.classId = filters.classId;
        if (filters?.period) params.period = filters.period;
        if (filters?.startDate) params.startDate = filters.startDate;
        if (filters?.endDate) params.endDate = filters.endDate;
        if (filters?.scope) params.scope = filters.scope;
        
        const response = await api.get<DashboardStats>(`/schools/${schoolId}/dashboard`, {
            params: Object.keys(params).length > 0 ? params : undefined
        });
        return response.data;
    },

    async getAdminStats(filters?: { period?: PeriodType; startDate?: string; endDate?: string; scope?: AttendanceScope }): Promise<any> {
        const params: Record<string, string> = {};
        
        if (filters?.period) params.period = filters.period;
        if (filters?.startDate) params.startDate = filters.startDate;
        if (filters?.endDate) params.endDate = filters.endDate;
        if (filters?.scope) params.scope = filters.scope;
        
        const response = await api.get('/admin/dashboard', {
            params: Object.keys(params).length > 0 ? params : undefined
        });
        return response.data;
    },

    async getRecentEvents(schoolId: string, limit: number = 10): Promise<AttendanceEvent[]> {
        const response = await api.get<AttendanceEvent[]>(`/schools/${schoolId}/events`, { params: { limit } });
        return response.data;
    },

    async getEventHistory(
        schoolId: string,
        params: { startDate: string; endDate: string; limit?: number; classId?: string },
    ): Promise<{ data: AttendanceEvent[]; timezone: string; startDate: string; endDate: string }> {
        const response = await api.get(`/schools/${schoolId}/events/history`, { params });
        return response.data;
    },
};
