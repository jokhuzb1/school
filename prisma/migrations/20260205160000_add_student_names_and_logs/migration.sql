-- CreateEnum
CREATE TYPE "ProvisioningLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- AlterEnum
BEGIN;
CREATE TYPE "NvrProtocol_new" AS ENUM ('ONVIF', 'RTSP', 'HYBRID');
ALTER TABLE "Nvr" ALTER COLUMN "protocol" DROP DEFAULT;
ALTER TABLE "Nvr" ALTER COLUMN "protocol" TYPE "NvrProtocol_new" USING ("protocol"::text::"NvrProtocol_new");
ALTER TYPE "NvrProtocol" RENAME TO "NvrProtocol_old";
ALTER TYPE "NvrProtocol_new" RENAME TO "NvrProtocol";
DROP TYPE "NvrProtocol_old";
ALTER TABLE "Nvr" ALTER COLUMN "protocol" SET DEFAULT 'ONVIF';
COMMIT;

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'REGISTRATOR';

-- DropForeignKey
ALTER TABLE "AgentPairing" DROP CONSTRAINT "AgentPairing_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "School" DROP CONSTRAINT "School_mediaNodeId_fkey";

-- DropIndex
DROP INDEX "School_mediaNodeId_idx";

-- AlterTable
ALTER TABLE "Nvr" DROP COLUMN "rtspUrlTemplate";

-- AlterTable
ALTER TABLE "School" DROP COLUMN "mediaNodeId";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "AgentPairing";

-- DropTable
DROP TABLE "MediaNode";

-- CreateTable
CREATE TABLE "ProvisioningLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "provisioningId" TEXT,
    "deviceId" TEXT,
    "level" "ProvisioningLogLevel" NOT NULL DEFAULT 'INFO',
    "stage" TEXT NOT NULL,
    "status" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisioningLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProvisioningLog_schoolId_idx" ON "ProvisioningLog"("schoolId");

-- CreateIndex
CREATE INDEX "ProvisioningLog_provisioningId_idx" ON "ProvisioningLog"("provisioningId");

-- CreateIndex
CREATE INDEX "ProvisioningLog_studentId_idx" ON "ProvisioningLog"("studentId");

-- CreateIndex
CREATE INDEX "ProvisioningLog_deviceId_idx" ON "ProvisioningLog"("deviceId");

-- CreateIndex
CREATE INDEX "ProvisioningLog_level_idx" ON "ProvisioningLog"("level");

-- CreateIndex
CREATE INDEX "ProvisioningLog_createdAt_idx" ON "ProvisioningLog"("createdAt");

-- CreateIndex
CREATE INDEX "Student_schoolId_classId_lastName_firstName_idx" ON "Student"("schoolId", "classId", "lastName", "firstName");

-- AddForeignKey
ALTER TABLE "ProvisioningLog" ADD CONSTRAINT "ProvisioningLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningLog" ADD CONSTRAINT "ProvisioningLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningLog" ADD CONSTRAINT "ProvisioningLog_provisioningId_fkey" FOREIGN KEY ("provisioningId") REFERENCES "StudentProvisioning"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningLog" ADD CONSTRAINT "ProvisioningLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

