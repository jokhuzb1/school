import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export type CamerasHttpPrismaRepository = {
  nvr: PrismaLike["nvr"];
  camera: PrismaLike["camera"];
  cameraArea: PrismaLike["cameraArea"];
  $transaction: PrismaLike["$transaction"];
};

export function createCamerasHttpPrismaRepository(
  prisma: PrismaLike,
): CamerasHttpPrismaRepository {
  return {
    nvr: prisma.nvr,
    camera: prisma.camera,
    cameraArea: prisma.cameraArea,
    $transaction: prisma.$transaction.bind(prisma),
  };
}
