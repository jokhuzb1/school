import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export type AttendanceHttpPrismaRepository = {
  school: PrismaLike["school"];
  class: PrismaLike["class"];
  student: PrismaLike["student"];
  dailyAttendance: PrismaLike["dailyAttendance"];
  attendanceEvent: PrismaLike["attendanceEvent"];
  teacherClass: PrismaLike["teacherClass"];
  device: PrismaLike["device"];
  $transaction: PrismaLike["$transaction"];
};

export function createAttendanceHttpPrismaRepository(
  prisma: PrismaLike,
): AttendanceHttpPrismaRepository {
  return {
    school: prisma.school,
    class: prisma.class,
    student: prisma.student,
    dailyAttendance: prisma.dailyAttendance,
    attendanceEvent: prisma.attendanceEvent,
    teacherClass: prisma.teacherClass,
    device: prisma.device,
    $transaction: prisma.$transaction.bind(prisma),
  };
}
