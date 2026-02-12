import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export function createDevicesPrismaRepository(prisma: PrismaLike) {
  return {
    findManyBySchoolId(schoolId: string) {
      return prisma.device.findMany({ where: { schoolId } });
    },
    findByDeviceId(deviceId: string) {
      return prisma.device.findUnique({
        where: { deviceId },
        select: { id: true, schoolId: true },
      });
    },
    createDevice(input: {
      name: string;
      deviceId: string;
      type: any;
      location?: string | null;
      schoolId: string;
    }) {
      return prisma.device.create({ data: input });
    },
    updateDevice(id: string, data: any) {
      return prisma.device.update({ where: { id }, data });
    },
    deleteDeviceWithRelations(id: string) {
      return prisma.$transaction(async (tx) => {
        await tx.attendanceEvent.updateMany({
          where: { deviceId: id },
          data: { deviceId: null },
        });
        await tx.provisioningLog.updateMany({
          where: { deviceId: id },
          data: { deviceId: null },
        });
        await tx.studentDeviceLink.deleteMany({
          where: { deviceId: id },
        });

        return tx.device.delete({ where: { id } });
      });
    },
    findDeviceHealthBase(id: string) {
      return prisma.device.findUnique({
        where: { id },
        select: { id: true, schoolId: true, lastSeenAt: true },
      });
    },
    findLastWebhookEvent(id: string) {
      return prisma.attendanceEvent.findFirst({
        where: { deviceId: id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      });
    },
  };
}
