import prisma from "./src/prisma";
import { WEBRTC_BASE_URL } from "./src/config";

function buildWhepUrl(path: string): string | null {
  if (!WEBRTC_BASE_URL) return null;
  const trimmed = WEBRTC_BASE_URL.replace(/\/+$/, "");
  return `${trimmed}/${path}/whep`;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function main() {
  const schoolId = process.env.SCHOOL_ID || "";
  if (!schoolId) throw new Error("Missing SCHOOL_ID env var");

  console.log("\n=== Environment ===");
  console.log("WEBRTC_BASE_URL:", WEBRTC_BASE_URL);

  const cameras = await prisma.camera.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      externalId: true,
      streamUrl: true,
      channelNo: true,
      status: true,
    },
  });

  console.log("\n=== Cameras in School ===");
  for (const camera of cameras) {
    const pathSegment = camera.externalId?.trim()
      ? sanitizePathSegment(camera.externalId)
      : camera.id;
    const webrtcPath = `schools/${schoolId}/cameras/${pathSegment}`;

    console.log(`\nCamera: ${camera.name}`);
    console.log(`  ID: ${camera.id}`);
    console.log(`  ExternalId: ${camera.externalId || "null"}`);
    console.log(`  ChannelNo: ${camera.channelNo}`);
    console.log(`  Status: ${camera.status}`);
    console.log(`  StreamUrl: ${camera.streamUrl ? "(configured)" : "null"}`);
    console.log(`  WebRTC Path: ${webrtcPath}`);
    console.log(`  WHEP URL: ${buildWhepUrl(webrtcPath)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
