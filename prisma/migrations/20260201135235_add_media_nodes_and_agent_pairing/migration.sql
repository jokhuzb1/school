-- AlterTable
ALTER TABLE "School" ADD COLUMN     "mediaNodeId" TEXT;

-- CreateTable
CREATE TABLE "MediaNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webrtcBaseUrl" TEXT NOT NULL,
    "hlsBaseUrl" TEXT,
    "rtspPullEgressIp" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "capacityWeight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPairing" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "AgentPairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaNode_isActive_idx" ON "MediaNode"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPairing_code_key" ON "AgentPairing"("code");

-- CreateIndex
CREATE INDEX "AgentPairing_schoolId_idx" ON "AgentPairing"("schoolId");

-- CreateIndex
CREATE INDEX "AgentPairing_expiresAt_idx" ON "AgentPairing"("expiresAt");

-- CreateIndex
CREATE INDEX "School_mediaNodeId_idx" ON "School"("mediaNodeId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_mediaNodeId_fkey" FOREIGN KEY ("mediaNodeId") REFERENCES "MediaNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPairing" ADD CONSTRAINT "AgentPairing_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


