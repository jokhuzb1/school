import bcrypt from "bcryptjs";
import { IS_PROD, SSE_TOKEN_TTL_SECONDS } from "../../../../config";
import prisma from "../../../../prisma";
import { logAudit } from "../../../../utils/audit";

export type AuthHttpDeps = {
  prisma: typeof prisma;
  bcrypt: typeof bcrypt;
  IS_PROD: typeof IS_PROD;
  SSE_TOKEN_TTL_SECONDS: typeof SSE_TOKEN_TTL_SECONDS;
  logAudit: typeof logAudit;
};

export function createAuthHttpDeps(): AuthHttpDeps {
  return {
    prisma,
    bcrypt,
    IS_PROD,
    SSE_TOKEN_TTL_SECONDS,
    logAudit,
  };
}
