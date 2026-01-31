-- DropForeignKey
ALTER TABLE "Camera" DROP CONSTRAINT "Camera_nvrId_fkey";

-- DropForeignKey
ALTER TABLE "CameraArea" DROP CONSTRAINT "CameraArea_nvrId_fkey";

-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "autoGenerateUrl" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "streamProfile" TEXT NOT NULL DEFAULT 'main';

-- AddForeignKey
ALTER TABLE "CameraArea" ADD CONSTRAINT "CameraArea_nvrId_fkey" FOREIGN KEY ("nvrId") REFERENCES "Nvr"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_nvrId_fkey" FOREIGN KEY ("nvrId") REFERENCES "Nvr"("id") ON DELETE SET NULL ON UPDATE CASCADE;
