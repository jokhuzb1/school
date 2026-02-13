import { api } from "@shared/api";
import type { Device } from "@shared/types";
import { isMockMode, mockDevicesService } from "@/mock";

export const devicesService = {
  async getAll(schoolId: string): Promise<Device[]> {
    if (isMockMode()) {
      return mockDevicesService.getAll(schoolId);
    }
    const response = await api.get<Device[]>(`/schools/${schoolId}/devices`);
    return response.data;
  },

  async create(schoolId: string, data: Partial<Device>): Promise<Device> {
    if (isMockMode()) {
      return mockDevicesService.create(schoolId, data);
    }
    const response = await api.post<Device>(`/schools/${schoolId}/devices`, data);
    return response.data;
  },

  async update(id: string, data: Partial<Device>): Promise<Device> {
    if (isMockMode()) {
      return mockDevicesService.update(id, data);
    }
    const response = await api.put<Device>(`/devices/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    if (isMockMode()) {
      return mockDevicesService.delete(id);
    }
    await api.delete(`/devices/${id}`);
  },
};

