import prisma from "./src/prisma";

async function updateToMainStream() {
  const schoolId = "4521bf61-2255-4bf0-be33-5d56fd9f6a87";

  console.log("Updating camera stream URLs to MAIN stream (H.265)...\n");

  // Camera 1 - ch1/main
  await prisma.camera.update({
    where: { id: "db1cbc98-6063-4e7f-91af-35c8c6ea9915" },
    data: {
      streamUrl: "rtsp://admin:Paa123nv@192.168.100.58:554/ch1/main/av_stream",
    },
  });
  console.log("✅ cam1: ch1/main/av_stream");

  // Camera 2 - ch2/main
  await prisma.camera.update({
    where: { id: "4996e6d7-330f-4afb-898b-d2af577339ee" },
    data: {
      streamUrl: "rtsp://admin:Paa123nv@192.168.100.58:554/ch2/main/av_stream",
    },
  });
  console.log("✅ cam2: ch2/main/av_stream");

  // Camera 3 - ch2/main
  await prisma.camera.update({
    where: { id: "62f2612a-50bc-4a02-abfe-3f53903f4f4a" },
    data: {
      streamUrl: "rtsp://admin:Paa123nv@192.168.100.58:554/ch2/main/av_stream",
    },
  });
  console.log("✅ cam3: ch2/main/av_stream");

  console.log("\nDone! All cameras updated to MAIN stream (H.265)");
}

updateToMainStream()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
