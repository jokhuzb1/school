-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARTIAL', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeviceProvisioningStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "deviceSyncStatus" "ProvisioningStatus",
ADD COLUMN     "deviceSyncUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StudentProvisioning" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDeviceLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "provisioningId" TEXT NOT NULL,
    "status" "DeviceProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "employeeNoOnDevice" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDeviceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProvisioning_requestId_key" ON "StudentProvisioning"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDeviceLink_provisioningId_deviceId_key" ON "StudentDeviceLink"("provisioningId", "deviceId");

-- CreateIndex
CREATE INDEX "StudentProvisioning_studentId_idx" ON "StudentProvisioning"("studentId");

-- CreateIndex
CREATE INDEX "StudentProvisioning_schoolId_idx" ON "StudentProvisioning"("schoolId");

-- CreateIndex
CREATE INDEX "StudentProvisioning_status_idx" ON "StudentProvisioning"("status");

-- CreateIndex
CREATE INDEX "StudentDeviceLink_studentId_idx" ON "StudentDeviceLink"("studentId");

-- CreateIndex
CREATE INDEX "StudentDeviceLink_deviceId_idx" ON "StudentDeviceLink"("deviceId");

-- CreateIndex
CREATE INDEX "StudentDeviceLink_status_idx" ON "StudentDeviceLink"("status");

-- AddForeignKey
ALTER TABLE "StudentProvisioning" ADD CONSTRAINT "StudentProvisioning_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProvisioning" ADD CONSTRAINT "StudentProvisioning_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeviceLink" ADD CONSTRAINT "StudentDeviceLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeviceLink" ADD CONSTRAINT "StudentDeviceLink_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDeviceLink" ADD CONSTRAINT "StudentDeviceLink_provisioningId_fkey" FOREIGN KEY ("provisioningId") REFERENCES "StudentProvisioning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
