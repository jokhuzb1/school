import bcrypt from "bcryptjs";
import prisma from "../../../../prisma";
import { requireRoles, requireSchoolScope } from "../../../../utils/authz";
import { sendHttpError } from "../../../../utils/httpErrors";

export type UsersHttpDeps = {
  prisma: typeof prisma;
  bcrypt: typeof bcrypt;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
};

export function createUsersHttpDeps(): UsersHttpDeps {
  return {
    prisma,
    bcrypt,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
  };
}
