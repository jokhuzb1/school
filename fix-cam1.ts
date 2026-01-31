import prisma from "./src/prisma";

async function fixCamera1() {
  const schoolId = "4521bf61-2255-4bf0-be33-5d56fd9f6a87";

  // cam1 ID
  const cam1Id = "db1cbc98-6063-4e7f-91af-35c8c6ea9915";

  console.log("Fixing cam1 stream URL...\n");

  // Update cam1 to use correct sub stream format
  await prisma.camera.update({
    where: { id: cam1Id },
    data: {
      streamUrl: "rtsp://admin:Paa123nv@192.168.100.58:554/ch1/sub/av_stream",
    },
  });

  console.log("✅ cam1 updated to:");
  console.log("   rtsp://admin:Paa123nv@192.168.100.58:554/ch1/sub/av_stream");
  console.log("\nDone!");
}

fixCamera1()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
