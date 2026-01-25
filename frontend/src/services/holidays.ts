import api from './api';
import type { Holiday } from '../types';

export const holidaysService = {
    async getAll(schoolId: string): Promise<Holiday[]> {
        const response = await api.get<Holiday[]>(`/schools/${schoolId}/holidays`);
        return response.data;
    },

    async create(schoolId: string, data: Partial<Holiday>): Promise<Holiday> {
        const response = await api.post<Holiday>(`/schools/${schoolId}/holidays`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/holidays/${id}`);
    },
};
