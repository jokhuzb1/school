-- Add GB28181 protocol enum value
ALTER TYPE "NvrProtocol" ADD VALUE IF NOT EXISTS 'GB28181';

-- Add RTSP template for gateway/custom devices
ALTER TABLE "Nvr" ADD COLUMN "rtspUrlTemplate" TEXT;
