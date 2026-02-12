import { api } from "@shared/api";
import type { Holiday } from "@shared/types";
import { isMockMode, mockHolidaysService } from "@/mock";

export const holidaysService = {
  async getAll(schoolId: string): Promise<Holiday[]> {
    if (isMockMode()) {
      return mockHolidaysService.getAll(schoolId);
    }
    const response = await api.get<Holiday[]>(`/schools/${schoolId}/holidays`);
    return response.data;
  },

  async create(schoolId: string, data: Partial<Holiday>): Promise<Holiday> {
    if (isMockMode()) {
      return mockHolidaysService.create(schoolId, data);
    }
    const response = await api.post<Holiday>(`/schools/${schoolId}/holidays`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    if (isMockMode()) {
      return mockHolidaysService.delete(id);
    }
    await api.delete(`/holidays/${id}`);
  },
};

