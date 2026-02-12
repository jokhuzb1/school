import { api } from "@shared/api";
import type { Class } from "@shared/types";
import { isMockMode, mockClassesService } from "@/mock";

export const classesService = {
  async getAll(schoolId: string): Promise<Class[]> {
    if (isMockMode()) {
      return mockClassesService.getAll(schoolId);
    }
    const response = await api.get<Class[]>(`/schools/${schoolId}/classes`);
    return response.data;
  },

  async create(schoolId: string, data: Partial<Class>): Promise<Class> {
    if (isMockMode()) {
      return mockClassesService.create(schoolId, data);
    }
    const response = await api.post<Class>(`/schools/${schoolId}/classes`, data);
    return response.data;
  },

  async update(id: string, data: Partial<Class>): Promise<Class> {
    if (isMockMode()) {
      return mockClassesService.update(id, data);
    }
    const response = await api.put<Class>(`/classes/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    if (isMockMode()) {
      return mockClassesService.delete(id);
    }
    await api.delete(`/classes/${id}`);
  },
};

