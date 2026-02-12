import prisma from "./src/prisma";

type UpdateItem = { id: string; rtspUrl: string };

async function main() {
  const updatesJson = process.env.CAMERA_RTSP_UPDATES_JSON || "";
  if (!updatesJson) {
    throw new Error(
      "Missing CAMERA_RTSP_UPDATES_JSON env var (example: [{\"id\":\"...\",\"rtspUrl\":\"rtsp://...\"}])",
    );
  }

  const updates = JSON.parse(updatesJson) as UpdateItem[];
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("CAMERA_RTSP_UPDATES_JSON must be a non-empty array");
  }

  for (const item of updates) {
    if (!item?.id || !item?.rtspUrl) {
      throw new Error("Each update must include id and rtspUrl");
    }
    await prisma.camera.update({
      where: { id: item.id },
      data: { streamUrl: item.rtspUrl },
    });
  }

  console.log(`Updated ${updates.length} camera(s).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
