import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const schoolId = process.env.SCHOOL_ID || "school1";
  const outFile = process.env.SECRETS_OUT_FILE; // e.g. ".secrets.json"

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    throw new Error(`School not found: ${schoolId}`);
  }

  const payload = {
    in: school.webhookSecretIn,
    out: school.webhookSecretOut,
  };

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
    console.log(`Wrote secrets to ${outFile}`);
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
