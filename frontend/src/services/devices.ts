import api from './api';
import type { Device } from '../types';

export const devicesService = {
    async getAll(schoolId: string): Promise<Device[]> {
        const response = await api.get<Device[]>(`/schools/${schoolId}/devices`);
        return response.data;
    },

    async create(schoolId: string, data: Partial<Device>): Promise<Device> {
        const response = await api.post<Device>(`/schools/${schoolId}/devices`, data);
        return response.data;
    },

    async update(id: string, data: Partial<Device>): Promise<Device> {
        const response = await api.put<Device>(`/devices/${id}`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/devices/${id}`);
    },
};
