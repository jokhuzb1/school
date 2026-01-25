import api from './api';
import type { DashboardStats, AttendanceEvent } from '../types';

export const dashboardService = {
    async getStats(schoolId: string): Promise<DashboardStats> {
        const response = await api.get<DashboardStats>(`/schools/${schoolId}/dashboard`);
        return response.data;
    },

    async getRecentEvents(schoolId: string, limit: number = 10): Promise<AttendanceEvent[]> {
        const response = await api.get<AttendanceEvent[]>(`/schools/${schoolId}/events`, { params: { limit } });
        return response.data;
    },
};
