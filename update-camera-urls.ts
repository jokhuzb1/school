import prisma from "./src/prisma";

async function updateCameraStreams() {
  const schoolId = "4521bf61-2255-4bf0-be33-5d56fd9f6a87";

  console.log("Updating camera stream URLs to SUB stream...\n");

  // Update all cameras to use SUB stream
  const cameras = await prisma.camera.findMany({
    where: { schoolId },
  });

  for (const cam of cameras) {
    let newUrl = null;

    if (cam.streamUrl?.includes("192.168.100.58")) {
      // Replace main with sub
      newUrl = cam.streamUrl.replace("/main/", "/sub/");

      await prisma.camera.update({
        where: { id: cam.id },
        data: { streamUrl: newUrl },
      });

      console.log(`✅ ${cam.name}: Updated to SUB stream`);
      console.log(`   Old: ${cam.streamUrl}`);
      console.log(`   New: ${newUrl}\n`);
    } else {
      console.log(`⚠️  ${cam.name}: Skipped (different format)`);
      console.log(`   URL: ${cam.streamUrl}\n`);
    }
  }

  console.log("Done!");
}

updateCameraStreams()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
