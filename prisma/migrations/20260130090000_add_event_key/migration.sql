-- Add eventKey for idempotency
ALTER TABLE "AttendanceEvent" ADD COLUMN "eventKey" TEXT;

-- Backfill for existing rows
UPDATE "AttendanceEvent" SET "eventKey" = "id" WHERE "eventKey" IS NULL;

ALTER TABLE "AttendanceEvent" ALTER COLUMN "eventKey" SET NOT NULL;

CREATE UNIQUE INDEX "AttendanceEvent_eventKey_key" ON "AttendanceEvent"("eventKey");
