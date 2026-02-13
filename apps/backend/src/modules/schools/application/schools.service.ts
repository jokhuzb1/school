type SchoolsRepository = {
  findAllSchoolsWithCounts(): Promise<any[]>;
  findClassesForSchoolStats(
    schoolId: string,
  ): Promise<Array<{ id: string; startTime: string | null; endTime: string | null }>>;
  groupActiveStudentsByClass(
    schoolId: string,
    classIds: string[],
  ): Promise<Array<{ classId: string | null; _count: { _all?: number } | number }>>;
  findUserByEmail(email: string): Promise<any>;
  createSchoolWithOptionalAdmin(input: {
    school: {
      name: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      lateThresholdMinutes: number;
      absenceCutoffMinutes: number;
      webhookSecretIn: string;
      webhookSecretOut: string;
    };
    admin?: {
      name: string;
      email: string;
      password: string;
    };
  }): Promise<{ school: any; admin: any }>;
  findSchoolById(id: string): Promise<any>;
  updateSchoolById(id: string, data: any): Promise<any>;
};

type ClassCountRow = { classId: string | null; _count: { _all?: number } | number };

export function createSchoolsService(repository: SchoolsRepository) {
  return {
    async listSchoolsWithTodayStats(input: {
      scope?: "started" | "active";
      addDaysUtc: (date: Date, days: number) => Date;
      getDateOnlyInZone: (date: Date, tz: string) => Date;
      getNowMinutesInZone: (date: Date, tz: string) => number;
      getActiveClassIds: (params: {
        classes: Array<{ id: string; startTime: string | null; endTime: string | null }>;
        nowMinutes: number;
        absenceCutoffMinutes: number;
      }) => string[];
      getStartedClassIds: (params: {
        classes: Array<{ id: string; startTime: string | null }>;
        nowMinutes: number;
      }) => string[];
      getStatusCountsByRange: (params: {
        schoolId: string;
        dateRange: { startDate: Date; endDate: Date };
        classIds: string[];
      }) => Promise<{ counts: { present: number; late: number; absent: number; excused: number } }>;
      computeNoScanSplit: (params: {
        schoolId: string;
        dateStart: Date;
        dateEnd: Date;
        classIds: string[];
        classes: Array<{ id: string; startTime: string | null }>;
        classStudentCounts: ClassCountRow[];
        absenceCutoffMinutes: number;
        nowMinutes: number;
      }) => Promise<{
        noScanSplit: { pendingEarly: number; pendingLate: number; absent: number };
        totalActiveStudents: number;
      }>;
      calculateAttendancePercent: (
        presentCount: number,
        lateCount: number,
        totalStudents: number,
      ) => number;
    }) {
      const {
        scope,
        addDaysUtc,
        getDateOnlyInZone,
        getNowMinutesInZone,
        getActiveClassIds,
        getStartedClassIds,
        getStatusCountsByRange,
        computeNoScanSplit,
        calculateAttendancePercent,
      } = input;
      const attendanceScope = scope === "active" ? "active" : "started";
      const schools = await repository.findAllSchoolsWithCounts();
      const now = new Date();

      return Promise.all(
        schools.map(async (school) => {
          const tz = school.timezone || "Asia/Tashkent";
          const today = getDateOnlyInZone(now, tz);
          const tomorrow = addDaysUtc(today, 1);
          const nowMinutes = getNowMinutesInZone(now, tz);

          const classes = await repository.findClassesForSchoolStats(school.id);
          const activeClassIds = getActiveClassIds({
            classes,
            nowMinutes,
            absenceCutoffMinutes: school.absenceCutoffMinutes,
          });
          const startedClassIds = getStartedClassIds({
            classes,
            nowMinutes,
          });
          const effectiveClassIds =
            attendanceScope === "active" ? activeClassIds : startedClassIds;
          const effectiveClassIdsWithFallback =
            attendanceScope === "started" && effectiveClassIds.length === 0
              ? classes.map((cls) => cls.id)
              : effectiveClassIds;

          if (effectiveClassIdsWithFallback.length === 0) {
            return {
              ...school,
              todayStats: {
                present: 0,
                late: 0,
                absent: 0,
                excused: 0,
                pendingEarly: 0,
                pendingLate: 0,
                attendancePercent: 0,
              },
            };
          }

          const [statusResult, classStudentCounts] = await Promise.all([
            getStatusCountsByRange({
              schoolId: school.id,
              dateRange: { startDate: today, endDate: today },
              classIds: effectiveClassIdsWithFallback,
            }),
            repository.groupActiveStudentsByClass(
              school.id,
              effectiveClassIdsWithFallback,
            ),
          ]);

          const classesForSplit = classes
            .filter((cls) => effectiveClassIdsWithFallback.includes(cls.id))
            .map((cls) => ({ id: cls.id, startTime: cls.startTime || null }));

          const { noScanSplit, totalActiveStudents } = await computeNoScanSplit({
            schoolId: school.id,
            dateStart: today,
            dateEnd: tomorrow,
            classIds: effectiveClassIdsWithFallback,
            classes: classesForSplit,
            classStudentCounts: classStudentCounts as ClassCountRow[],
            absenceCutoffMinutes: school.absenceCutoffMinutes,
            nowMinutes,
          });

          const { present, late, absent, excused } = statusResult.counts;
          const attendancePercent = calculateAttendancePercent(
            present,
            late,
            totalActiveStudents,
          );

          return {
            ...school,
            todayStats: {
              present,
              late,
              absent: absent + noScanSplit.absent,
              excused,
              pendingEarly: noScanSplit.pendingEarly,
              pendingLate: noScanSplit.pendingLate,
              attendancePercent,
            },
          };
        }),
      );
    },

    async createSchool(input: {
      name: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      lateThresholdMinutes?: number;
      absenceCutoffMinutes?: number;
      adminName?: string;
      adminEmail?: string;
      adminPassword?: string;
      uuidv4: () => string;
      hashPassword: (value: string, rounds: number) => Promise<string>;
    }) {
      const {
        name,
        address,
        phone,
        email,
        lateThresholdMinutes,
        absenceCutoffMinutes,
        adminName,
        adminEmail,
        adminPassword,
        uuidv4,
        hashPassword,
      } = input;

      if (adminEmail) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(adminEmail)) {
          return { error: "Noto'g'ri email formati", statusCode: 400 as const };
        }

        const existingUser = await repository.findUserByEmail(adminEmail);
        if (existingUser) {
          return {
            error: "Bu email allaqachon ro'yxatdan o'tgan",
            statusCode: 400 as const,
          };
        }
      }

      if (adminPassword && adminPassword.length < 6) {
        return {
          error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
          statusCode: 400 as const,
        };
      }

      const hashedAdminPassword =
        adminName && adminEmail && adminPassword
          ? await hashPassword(adminPassword, 10)
          : null;

      const result = await repository.createSchoolWithOptionalAdmin({
        school: {
          name,
          address,
          phone,
          email,
          lateThresholdMinutes: lateThresholdMinutes || 15,
          absenceCutoffMinutes: absenceCutoffMinutes || 180,
          webhookSecretIn: uuidv4(),
          webhookSecretOut: uuidv4(),
        },
        admin:
          adminName && adminEmail && hashedAdminPassword
            ? {
                name: adminName,
                email: adminEmail,
                password: hashedAdminPassword,
              }
            : undefined,
      });

      return {
        ...result.school,
        admin: result.admin
          ? {
              id: result.admin.id,
              name: result.admin.name,
              email: result.admin.email,
            }
          : null,
      };
    },

    getSchoolById(id: string) {
      return repository.findSchoolById(id);
    },

    updateSchoolById(id: string, data: any) {
      return repository.updateSchoolById(id, data);
    },
  };
}
