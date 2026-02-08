import prisma from "./src/prisma";

async function main() {
  const cameraId = process.env.CAMERA_ID || "";
  const rtspUrl = process.env.RTSP_URL || "";

  if (!cameraId) throw new Error("Missing CAMERA_ID env var");
  if (!rtspUrl) throw new Error("Missing RTSP_URL env var");

  await prisma.camera.update({
    where: { id: cameraId },
    data: { streamUrl: rtspUrl },
  });

  console.log("Updated camera streamUrl.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
