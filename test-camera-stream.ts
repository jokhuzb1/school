import prisma from "./src/prisma";
import { WEBRTC_BASE_URL } from "./src/config";

async function main() {
  const schoolId = "4521bf61-2255-4bf0-be33-5d56fd9f6a87";

  console.log("\n=== Environment ===");
  console.log("WEBRTC_BASE_URL:", WEBRTC_BASE_URL);

  console.log("\n=== Cameras in School ===");
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

  cameras.forEach((cam) => {
    console.log(`\nCamera: ${cam.name}`);
    console.log(`  ID: ${cam.id}`);
    console.log(`  ExternalId: ${cam.externalId || "null"}`);
    console.log(`  ChannelNo: ${cam.channelNo}`);
    console.log(`  Status: ${cam.status}`);
    console.log(`  StreamUrl: ${cam.streamUrl || "null"}`);

    // Calculate WebRTC path
    const pathSegment = cam.externalId?.trim()
      ? cam.externalId.replace(/[^a-zA-Z0-9._-]/g, "_")
      : cam.id;
    const webrtcPath = `schools/${schoolId}/cameras/${pathSegment}`;
    const webrtcUrl = WEBRTC_BASE_URL
      ? `${WEBRTC_BASE_URL.replace(/\/+$/, "")}/whep/${webrtcPath}`
      : null;

    console.log(`  WebRTC Path: ${webrtcPath}`);
    console.log(`  WebRTC URL: ${webrtcUrl}`);
  });

  console.log("\n=== MediaMTX Config Paths ===");
  console.log("Expected paths in mediamtx.yml:");
  cameras.forEach((cam) => {
    const pathSegment = cam.externalId?.trim()
      ? cam.externalId.replace(/[^a-zA-Z0-9._-]/g, "_")
      : cam.id;
    console.log(`  schools/${schoolId}/cameras/${pathSegment}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
