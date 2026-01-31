import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import { getTeacherClassFilter, isSuperAdmin } from "../../../utils/authz";

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

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/search",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const q = String(request.query?.q || "").trim();
      const limit = Math.min(Number(request.query?.limit || 6), 20);
      if (q.length < 2) {
        return { groups: [] };
      }

      const user = request.user as any;
      const superAdmin = isSuperAdmin(user);
      let schoolId: string | null = user?.schoolId || null;

      const groups: SearchGroup[] = [];

      if (superAdmin) {
        const schools = await prisma.school.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, address: true },
          take: limit,
        });
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

      // Teacher restriction to own classes
      let teacherClassFilter: string[] | null = null;
      if (user?.role === "TEACHER") {
        const result = await getTeacherClassFilter({
          teacherId: user.sub,
        });
        teacherClassFilter = result.allowedClassIds;
        if (!schoolId && teacherClassFilter.length) {
          const cls = await prisma.class.findFirst({
            where: { id: teacherClassFilter[0] },
            select: { schoolId: true },
          });
          schoolId = cls?.schoolId || null;
        }
      }

      const schoolFilter = superAdmin
        ? {}
        : schoolId
          ? { schoolId }
          : { schoolId: "__none__" };

      const students = await prisma.student.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          ...schoolFilter,
          ...(teacherClassFilter
            ? { classId: { in: teacherClassFilter.length ? teacherClassFilter : ["__none__"] } }
            : {}),
        },
        include: {
          class: { select: { name: true } },
          school: { select: { name: true } },
        },
        take: limit,
      });
      if (students.length) {
        groups.push({
          key: "students",
          label: "O'quvchilar",
          items: students.map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: `${s.class?.name || "Sinf yo'q"}${superAdmin ? ` · ${s.school?.name || "Maktab"}` : ""}`,
            route: `/students/${s.id}`,
          })),
        });
      }

      const classes = await prisma.class.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          ...schoolFilter,
          ...(teacherClassFilter
            ? { id: { in: teacherClassFilter.length ? teacherClassFilter : ["__none__"] } }
            : {}),
        },
        include: {
          school: { select: { name: true } },
        },
        take: limit,
      });
      if (classes.length) {
        groups.push({
          key: "classes",
          label: "Sinflar",
          items: classes.map((c) => ({
            id: c.id,
            title: c.name,
            subtitle: `${c.gradeLevel}-sinf${superAdmin ? ` · ${c.school?.name || "Maktab"}` : ""}`,
            route: `/schools/${c.schoolId}/classes/${c.id}`,
          })),
        });
      }

      if (superAdmin || user?.role === "SCHOOL_ADMIN") {
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
            ...schoolFilter,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            schoolId: true,
            school: { select: { name: true } },
          },
          take: limit,
        });
        if (users.length) {
          groups.push({
            key: "users",
            label: "Xodimlar",
            items: users.map((u) => ({
              id: u.id,
              title: u.name,
              subtitle: `${u.email} · ${u.role}${superAdmin ? ` · ${u.school?.name || "Maktab"}` : ""}`,
              route: `/schools/${u.schoolId || schoolId}/users`,
            })),
          });
        }
      }

      if (superAdmin || user?.role === "SCHOOL_ADMIN" || user?.role === "GUARD") {
        const devices = await prisma.device.findMany({
          where: {
            name: { contains: q, mode: "insensitive" },
            ...schoolFilter,
          },
          include: { school: { select: { name: true } } },
          take: limit,
        });
        if (devices.length) {
          groups.push({
            key: "devices",
            label: "Qurilmalar",
            items: devices.map((d) => ({
              id: d.id,
              title: d.name,
              subtitle: `${d.type}${d.location ? ` · ${d.location}` : ""}${
                superAdmin ? ` · ${d.school?.name || "Maktab"}` : ""
              }`,
              route: `/schools/${d.schoolId}/devices`,
            })),
          });
        }
      }

      return { groups };
    },
  );
}
