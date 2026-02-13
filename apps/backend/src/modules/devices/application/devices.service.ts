type DevicesRepository = {
  findManyBySchoolId(schoolId: string): Promise<any[]>;
  findByDeviceId(deviceId: string): Promise<{ id: string; schoolId: string } | null>;
  createDevice(input: {
    name: string;
    deviceId: string;
    type: any;
    location?: string | null;
    schoolId: string;
  }): Promise<any>;
  updateDevice(id: string, data: any): Promise<any>;
  deleteDeviceWithRelations(id: string): Promise<any>;
  findDeviceHealthBase(id: string): Promise<{
    id: string;
    schoolId: string;
    lastSeenAt: Date | null;
  } | null>;
  findLastWebhookEvent(id: string): Promise<{ timestamp: Date } | null>;
};

export function createDevicesService(repository: DevicesRepository) {
  return {
    listBySchoolId(schoolId: string) {
      return repository.findManyBySchoolId(schoolId);
    },

    async create(input: {
      name: string;
      deviceId: string;
      type: string;
      location?: string | null;
      schoolId: string;
    }) {
      const normalizedDeviceId = String(input.deviceId || "").trim();
      if (!normalizedDeviceId) {
        throw Object.assign(new Error("deviceId is required"), {
          statusCode: 400,
        });
      }

      const existingByDeviceId = await repository.findByDeviceId(normalizedDeviceId);
      if (existingByDeviceId) {
        throw Object.assign(new Error("deviceId already exists"), {
          statusCode: 409,
        });
      }

      return repository.createDevice({
        name: input.name,
        deviceId: normalizedDeviceId,
        type: input.type,
        location: input.location,
        schoolId: input.schoolId,
      });
    },

    async update(id: string, data: any) {
      const nextDeviceId = data?.deviceId ? String(data.deviceId).trim() : null;
      if (nextDeviceId) {
        const existing = await repository.findByDeviceId(nextDeviceId);
        if (existing && existing.id !== id) {
          throw Object.assign(new Error("deviceId already exists"), {
            statusCode: 409,
          });
        }
      }

      return repository.updateDevice(
        id,
        nextDeviceId ? { ...data, deviceId: nextDeviceId } : data,
      );
    },

    remove(id: string) {
      return repository.deleteDeviceWithRelations(id);
    },

    async getWebhookHealth(id: string) {
      const device = await repository.findDeviceHealthBase(id);
      if (!device) return null;

      const lastEvent = await repository.findLastWebhookEvent(id);
      return {
        ok: true,
        deviceId: id,
        lastWebhookEventAt: lastEvent?.timestamp || null,
        lastSeenAt: device.lastSeenAt || null,
      };
    },
  };
}
