-- AlterTable
ALTER TABLE "ProvisioningLog"
ADD COLUMN "eventType" TEXT,
ADD COLUMN "actorId" TEXT,
ADD COLUMN "actorRole" TEXT,
ADD COLUMN "actorName" TEXT,
ADD COLUMN "actorIp" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "ProvisioningLog_eventType_idx" ON "ProvisioningLog"("eventType");

-- CreateIndex
CREATE INDEX "ProvisioningLog_actorId_idx" ON "ProvisioningLog"("actorId");
