type ClassesRepository = {
  findTeacherClassIds(teacherId: string): Promise<Array<{ classId: string }>>;
  findSchoolTimezone(schoolId: string): Promise<{ timezone: string | null } | null>;
  findClasses(where: any): Promise<any[]>;
  countDailyAttendanceByStatus(input: {
    classId: string;
    from: Date;
    to: Date;
    status: "PRESENT" | "LATE" | "ABSENT";
  }): Promise<number>;
  createClass(data: {
    name: string;
    gradeLevel: number;
    schoolId: string;
    startTime: string;
    endTime?: string | null;
  }): Promise<any>;
  findClassById(id: string): Promise<any>;
  updateClass(id: string, data: any): Promise<any>;
  deleteClass(id: string): Promise<any>;
};

export async function listSchoolClassesWithAttendance(input: {
  repository: ClassesRepository;
  addDaysUtc: (date: Date, days: number) => Date;
  dateKeyToUtcDate: (dateKey: string) => Date;
  getDateKeyInZone: (date: Date, tz: string) => string;
  schoolId: string;
  user: { role?: string; sub?: string };
}) {
  const {
    repository,
    addDaysUtc,
    dateKeyToUtcDate,
    getDateKeyInZone,
    schoolId,
    user,
  } = input;

  let where: any = { schoolId };
  if (user.role === "TEACHER") {
    const rows = await repository.findTeacherClassIds(String(user.sub || ""));
    const classIds = rows.map((r) => r.classId);
    where = { ...where, id: { in: classIds.length ? classIds : ["__none__"] } };
  }

  const [school, classes] = await Promise.all([
    repository.findSchoolTimezone(schoolId),
    repository.findClasses(where),
  ]);

  const tz = school?.timezone || "Asia/Tashkent";
  const now = new Date();
  const todayKey = getDateKeyInZone(now, tz);
  const today = dateKeyToUtcDate(todayKey);
  const tomorrow = addDaysUtc(today, 1);

  return Promise.all(
    classes.map(async (cls) => {
      const [presentCount, lateCount, absentCount] = await Promise.all([
        repository.countDailyAttendanceByStatus({
          classId: cls.id,
          from: today,
          to: tomorrow,
          status: "PRESENT",
        }),
        repository.countDailyAttendanceByStatus({
          classId: cls.id,
          from: today,
          to: tomorrow,
          status: "LATE",
        }),
        repository.countDailyAttendanceByStatus({
          classId: cls.id,
          from: today,
          to: tomorrow,
          status: "ABSENT",
        }),
      ]);
      return {
        ...cls,
        todayPresent: presentCount,
        todayLate: lateCount,
        todayAbsent: absentCount,
        totalStudents: cls._count.students,
      };
    }),
  );
}

export function createSchoolClass(
  repository: ClassesRepository,
  input: {
    name: string;
    gradeLevel: number;
    schoolId: string;
    startTime?: string | null;
    endTime?: string | null;
  },
) {
  return repository.createClass({
    name: input.name,
    gradeLevel: input.gradeLevel,
    schoolId: input.schoolId,
    startTime: input.startTime || "08:00",
    endTime: input.endTime,
  });
}

export function findClassById(repository: ClassesRepository, id: string) {
  return repository.findClassById(id);
}

export function updateClassById(
  repository: ClassesRepository,
  id: string,
  data: any,
) {
  return repository.updateClass(id, data);
}

export async function deleteClassById(repository: ClassesRepository, id: string) {
  await repository.deleteClass(id);
}
