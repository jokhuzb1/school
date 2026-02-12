import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export type StudentsHttpPrismaRepository = {
  school: PrismaLike["school"];
  class: PrismaLike["class"];
  student: PrismaLike["student"];
  dailyAttendance: PrismaLike["dailyAttendance"];
  attendanceEvent: PrismaLike["attendanceEvent"];
  device: PrismaLike["device"];
  studentDeviceLink: PrismaLike["studentDeviceLink"];
  studentProvisioning: PrismaLike["studentProvisioning"];
  provisioningLog: PrismaLike["provisioningLog"];
  $transaction: PrismaLike["$transaction"];
};

export function createStudentsHttpPrismaRepository(
  prisma: PrismaLike,
): StudentsHttpPrismaRepository {
  return {
    school: prisma.school,
    class: prisma.class,
    student: prisma.student,
    dailyAttendance: prisma.dailyAttendance,
    attendanceEvent: prisma.attendanceEvent,
    device: prisma.device,
    studentDeviceLink: prisma.studentDeviceLink,
    studentProvisioning: prisma.studentProvisioning,
    provisioningLog: prisma.provisioningLog,
    $transaction: prisma.$transaction.bind(prisma),
  };
}
