import { PORT } from "../../config";
import { registerJobs } from "../../cron/jobs";
import { startMediaMtxAuto } from "../../modules/cameras/services/mediamtx-runner.service";
import prisma from "../../prisma";
import { startSnapshotScheduler } from "../../realtime/snapshotScheduler";
import { createServer, CreateServerParams } from "./create-server";

export async function startServer(params: CreateServerParams) {
  const server = createServer(params);

  try {
    await prisma.$connect();
    registerJobs(server);
    startSnapshotScheduler({ logger: server.log });

    // MediaMTX'ni avtomatik ishga tushirish (agar o'chirilmagan bo'lsa)
    if (process.env.MEDIAMTX_AUTO_START !== "false") {
      startMediaMtxAuto();
    }

    await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server listening on ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  return server;
}
