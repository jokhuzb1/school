import api from './api';
import type { Class } from '../types';

export const classesService = {
    async getAll(schoolId: string): Promise<Class[]> {
        const response = await api.get<Class[]>(`/schools/${schoolId}/classes`);
        return response.data;
    },

    async create(schoolId: string, data: Partial<Class>): Promise<Class> {
        const response = await api.post<Class>(`/schools/${schoolId}/classes`, data);
        return response.data;
    },

    async update(id: string, data: Partial<Class>): Promise<Class> {
        const response = await api.put<Class>(`/classes/${id}`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/classes/${id}`);
    },
};
