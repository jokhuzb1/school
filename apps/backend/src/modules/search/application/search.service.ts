type SearchUser = {
  sub?: string;
  role?: string;
  schoolId?: string | null;
};

type SearchRepository = {
  findSchools(q: string, limit: number): Promise<any[]>;
  findClassSchoolById(classId: string): Promise<{ schoolId: string } | null>;
  findStudents(input: {
    q: string;
    limit: number;
    schoolFilter: any;
    teacherClassFilter: string[] | null;
  }): Promise<any[]>;
  findClasses(input: {
    q: string;
    limit: number;
    schoolFilter: any;
    teacherClassFilter: string[] | null;
  }): Promise<any[]>;
  findUsers(input: { q: string; limit: number; schoolFilter: any }): Promise<any[]>;
  findDevices(input: { q: string; limit: number; schoolFilter: any }): Promise<any[]>;
};

type SearchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  route: string;
};

type SearchGroup = {
  key: string;
  label: string;
  items: SearchItem[];
};

export async function searchGlobal(input: {
  repository: SearchRepository;
  getTeacherClassFilter: (params: { teacherId: string }) => Promise<{
    allowedClassIds: string[];
  }>;
  isSuperAdmin: (user: any) => boolean;
  user: SearchUser;
  q: string;
  limit: number;
}) {
  const { repository, getTeacherClassFilter, isSuperAdmin, user, q, limit } = input;

  if (q.length < 2) {
    return { groups: [] as SearchGroup[] };
  }

  const superAdmin = isSuperAdmin(user);
  let schoolId: string | null = user?.schoolId || null;
  const groups: SearchGroup[] = [];

  if (superAdmin) {
    const schools = await repository.findSchools(q, limit);
    if (schools.length) {
      groups.push({
        key: "schools",
        label: "Maktablar",
        items: schools.map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: s.address,
          route: `/schools/${s.id}/dashboard`,
        })),
      });
    }
  }

  let teacherClassFilter: string[] | null = null;
  if (user?.role === "TEACHER") {
    const result = await getTeacherClassFilter({
      teacherId: String(user.sub || ""),
    });
    teacherClassFilter = result.allowedClassIds;
    if (!schoolId && teacherClassFilter.length) {
      const cls = await repository.findClassSchoolById(teacherClassFilter[0]);
      schoolId = cls?.schoolId || null;
    }
  }

  const schoolFilter = superAdmin
    ? {}
    : schoolId
      ? { schoolId }
      : { schoolId: "__none__" };

  const students = await repository.findStudents({
    q,
    limit,
    schoolFilter,
    teacherClassFilter,
  });
  if (students.length) {
    groups.push({
      key: "students",
      label: "O'quvchilar",
      items: students.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.class?.name || "Sinf yo'q"}${superAdmin ? ` Â· ${s.school?.name || "Maktab"}` : ""}`,
        route: `/students/${s.id}`,
      })),
    });
  }

  const classes = await repository.findClasses({
    q,
    limit,
    schoolFilter,
    teacherClassFilter,
  });
  if (classes.length) {
    groups.push({
      key: "classes",
      label: "Sinflar",
      items: classes.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.gradeLevel}-sinf${superAdmin ? ` Â· ${c.school?.name || "Maktab"}` : ""}`,
        route: `/schools/${c.schoolId}/classes/${c.id}`,
      })),
    });
  }

  if (superAdmin || user?.role === "SCHOOL_ADMIN") {
    const users = await repository.findUsers({
      q,
      limit,
      schoolFilter,
    });
    if (users.length) {
      groups.push({
        key: "users",
        label: "Xodimlar",
        items: users.map((u) => ({
          id: u.id,
          title: u.name,
          subtitle: `${u.email} Â· ${u.role}${superAdmin ? ` Â· ${u.school?.name || "Maktab"}` : ""}`,
          route: `/schools/${u.schoolId || schoolId}/users`,
        })),
      });
    }
  }

  if (superAdmin || user?.role === "SCHOOL_ADMIN" || user?.role === "GUARD") {
    const devices = await repository.findDevices({
      q,
      limit,
      schoolFilter,
    });
    if (devices.length) {
      groups.push({
        key: "devices",
        label: "Qurilmalar",
        items: devices.map((d) => ({
          id: d.id,
          title: d.name,
          subtitle: `${d.type}${d.location ? ` Â· ${d.location}` : ""}${
            superAdmin ? ` Â· ${d.school?.name || "Maktab"}` : ""
          }`,
          route: `/schools/${d.schoolId}/devices`,
        })),
      });
    }
  }

  return { groups };
}
