import api from './api';
import type { School } from '../types';

export const schoolsService = {
    async getAll(): Promise<School[]> {
        const response = await api.get<School[]>('/schools');
        return response.data;
    },

    async getById(id: string): Promise<School> {
        const response = await api.get<School>(`/schools/${id}`);
        return response.data;
    },

    async create(data: Partial<School>): Promise<School> {
        const response = await api.post<School>('/schools', data);
        return response.data;
    },

    async update(id: string, data: Partial<School>): Promise<School> {
        const response = await api.put<School>(`/schools/${id}`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/schools/${id}`);
    },

    async getWebhookInfo(id: string): Promise<{ inUrl: string; outUrl: string }> {
        const response = await api.get(`/schools/${id}/webhook-info`);
        return response.data;
    },
};
