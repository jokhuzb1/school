import api from './api';
import type { Student, DailyAttendance, PaginatedResponse } from '../types';

export const studentsService = {
    async getAll(schoolId: string, params?: { page?: number; search?: string; classId?: string }): Promise<PaginatedResponse<Student>> {
        const response = await api.get<PaginatedResponse<Student>>(`/schools/${schoolId}/students`, { params });
        return response.data;
    },

    async getById(id: string): Promise<Student> {
        const response = await api.get<Student>(`/students/${id}`);
        return response.data;
    },

    async create(schoolId: string, data: Partial<Student>): Promise<Student> {
        const response = await api.post<Student>(`/schools/${schoolId}/students`, data);
        return response.data;
    },

    async update(id: string, data: Partial<Student>): Promise<Student> {
        const response = await api.put<Student>(`/students/${id}`, data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/students/${id}`);
    },

    async getAttendance(id: string, params?: { month?: string }): Promise<DailyAttendance[]> {
        const response = await api.get<DailyAttendance[]>(`/students/${id}/attendance`, { params });
        return response.data;
    },

    async importExcel(schoolId: string, file: File): Promise<{ imported: number }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post(`/schools/${schoolId}/students/import`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
};
