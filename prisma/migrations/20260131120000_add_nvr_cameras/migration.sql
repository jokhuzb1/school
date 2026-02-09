-- CreateEnum
CREATE TYPE "NvrProtocol" AS ENUM ('ONVIF', 'RTSP', 'HYBRID');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Nvr" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "host" TEXT NOT NULL,
    "httpPort" INTEGER NOT NULL DEFAULT 80,
    "onvifPort" INTEGER NOT NULL DEFAULT 80,
    "rtspPort" INTEGER NOT NULL DEFAULT 554,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "protocol" "NvrProtocol" NOT NULL DEFAULT 'ONVIF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthStatus" TEXT,
    "lastHealthError" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nvr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraArea" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nvrId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camera" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nvrId" TEXT,
    "areaId" TEXT,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "channelNo" INTEGER,
    "streamUrl" TEXT,
    "status" "CameraStatus" NOT NULL DEFAULT 'UNKNOWN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Nvr_schoolId_idx" ON "Nvr"("schoolId");

-- CreateIndex
CREATE INDEX "Nvr_schoolId_isActive_idx" ON "Nvr"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "Nvr_host_idx" ON "Nvr"("host");

-- CreateIndex
CREATE INDEX "CameraArea_schoolId_idx" ON "CameraArea"("schoolId");

-- CreateIndex
CREATE INDEX "CameraArea_nvrId_idx" ON "CameraArea"("nvrId");

-- CreateIndex
CREATE INDEX "CameraArea_schoolId_name_idx" ON "CameraArea"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CameraArea_nvrId_externalId_key" ON "CameraArea"("nvrId", "externalId");

-- CreateIndex
CREATE INDEX "Camera_schoolId_idx" ON "Camera"("schoolId");

-- CreateIndex
CREATE INDEX "Camera_nvrId_idx" ON "Camera"("nvrId");

-- CreateIndex
CREATE INDEX "Camera_areaId_idx" ON "Camera"("areaId");

-- CreateIndex
CREATE INDEX "Camera_schoolId_isActive_idx" ON "Camera"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Camera_nvrId_externalId_key" ON "Camera"("nvrId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Camera_nvrId_channelNo_key" ON "Camera"("nvrId", "channelNo");

-- AddForeignKey
ALTER TABLE "Nvr" ADD CONSTRAINT "Nvr_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraArea" ADD CONSTRAINT "CameraArea_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraArea" ADD CONSTRAINT "CameraArea_nvrId_fkey" FOREIGN KEY ("nvrId") REFERENCES "Nvr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_nvrId_fkey" FOREIGN KEY ("nvrId") REFERENCES "Nvr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CameraArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reordered from removed 20260131070223_add_nvr_cameras to avoid altering before table exists
-- DropForeignKey
ALTER TABLE "Camera" DROP CONSTRAINT "Camera_nvrId_fkey";

-- DropForeignKey
ALTER TABLE "CameraArea" DROP CONSTRAINT "CameraArea_nvrId_fkey";

-- AddForeignKey
ALTER TABLE "CameraArea" ADD CONSTRAINT "CameraArea_nvrId_fkey" FOREIGN KEY ("nvrId") REFERENCES "Nvr"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_nvrId_fkey" FOREIGN KEY ("nvrId") REFERENCES "Nvr"("id") ON DELETE SET NULL ON UPDATE CASCADE;
