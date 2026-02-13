import { api } from "@shared/api";
import type { AttendanceScope, School } from "@shared/types";
import { isMockMode, mockSchoolsService } from "@/mock";

export const schoolsService = {
  async getAll(scope?: AttendanceScope): Promise<School[]> {
    if (isMockMode()) {
      return mockSchoolsService.getAll();
    }
    const params = scope ? { scope } : undefined;
    const response = await api.get<School[]>("/schools", { params });
    return response.data;
  },

  async getById(id: string): Promise<School> {
    if (isMockMode()) {
      return mockSchoolsService.getById(id);
    }
    const response = await api.get<School>(`/schools/${id}`);
    return response.data;
  },

  async create(data: Partial<School>): Promise<School> {
    if (isMockMode()) {
      return mockSchoolsService.create(data);
    }
    const response = await api.post<School>("/schools", data);
    return response.data;
  },

  async update(id: string, data: Partial<School>): Promise<School> {
    if (isMockMode()) {
      return mockSchoolsService.update(id, data);
    }
    const response = await api.put<School>(`/schools/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    if (isMockMode()) {
      return mockSchoolsService.delete(id);
    }
    await api.delete(`/schools/${id}`);
  },

  async getWebhookInfo(id: string): Promise<{
    enforceSecret: boolean;
    secretHeaderName: string;
    inUrl: string;
    outUrl: string;
    inUrlWithSecret: string;
    outUrlWithSecret: string;
    inSecret: string;
    outSecret: string;
  }> {
    if (isMockMode()) {
      return mockSchoolsService.getWebhookInfo(id);
    }
    const response = await api.get(`/schools/${id}/webhook-info`);
    return response.data;
  },
};

