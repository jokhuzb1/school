import prisma from "./src/prisma";

async function main() {
  const schoolId = process.env.SCHOOL_ID || "";
  const matchHost = process.env.MATCH_HOST || "";
  const from = process.env.FROM_SEGMENT || "/main/";
  const to = process.env.TO_SEGMENT || "/sub/";

  if (!schoolId) throw new Error("Missing SCHOOL_ID env var");
  if (!matchHost) throw new Error("Missing MATCH_HOST env var");

  console.log(`Updating camera stream URLs for school=${schoolId}`);
  console.log(`Match host: ${matchHost}`);
  console.log(`Replace: ${from} -> ${to}\n`);

  const cameras = await prisma.camera.findMany({ where: { schoolId } });

  for (const camera of cameras) {
    if (!camera.streamUrl) {
      console.log(`Skipped: ${camera.name} (no streamUrl)`);
      continue;
    }

    if (!camera.streamUrl.includes(matchHost)) {
      console.log(`Skipped: ${camera.name} (different host)`);
      continue;
    }

    const newUrl = camera.streamUrl.replace(from, to);
    if (newUrl === camera.streamUrl) {
      console.log(`Skipped: ${camera.name} (no change)`);
      continue;
    }

    await prisma.camera.update({
      where: { id: camera.id },
      data: { streamUrl: newUrl },
    });

    console.log(`Updated: ${camera.name}`);
  }

  console.log("\nDone!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
