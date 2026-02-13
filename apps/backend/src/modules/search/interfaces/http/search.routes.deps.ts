import prisma from "../../../../prisma";
import { getTeacherClassFilter, isSuperAdmin } from "../../../../utils/authz";

export type SearchHttpDeps = {
  prisma: typeof prisma;
  getTeacherClassFilter: typeof getTeacherClassFilter;
  isSuperAdmin: typeof isSuperAdmin;
};

export function createSearchHttpDeps(): SearchHttpDeps {
  return {
    prisma,
    getTeacherClassFilter,
    isSuperAdmin,
  };
}
