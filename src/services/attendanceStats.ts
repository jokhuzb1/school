import prisma from "../prisma";

export async function getAttendanceCountsByClass(params: {
  schoolId: string;
  dateStart: Date;
  dateEnd: Date;
  classIds: string[];
}): Promise<{ classAttendanceMap: Map<string, number>; unassignedAttended: number }> {
  const { schoolId, dateStart, dateEnd, classIds } = params;

  if (!classIds.length) {
    return { classAttendanceMap: new Map(), unassignedAttended: 0 };
  }

  const records = await prisma.dailyAttendance.findMany({
    where: {
      schoolId,
      date: { gte: dateStart, lt: dateEnd },
      student: { classId: { in: classIds } },
    },
    select: {
      student: { select: { classId: true } },
    },
  });

  const classAttendanceMap = new Map<string, number>();
  let unassignedAttended = 0;

  records.forEach((row) => {
    const classId = row.student?.classId || null;
    if (classId) {
      classAttendanceMap.set(
        classId,
        (classAttendanceMap.get(classId) || 0) + 1,
      );
    } else {
      unassignedAttended += 1;
    }
  });

  return { classAttendanceMap, unassignedAttended };
}