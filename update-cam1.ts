import prisma from "./src/prisma";

async function updateCam1() {
  await prisma.camera.update({
    where: { id: "db1cbc98-6063-4e7f-91af-35c8c6ea9915" },
    data: {
      streamUrl: "rtsp://admin:Paa123nv@192.168.100.58:554/ch1/main/av_stream",
    },
  });
  console.log("✅ cam1 updated to 192.168.100.58 main stream");
}

updateCam1()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
