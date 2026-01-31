-- AlterTable: Add IN/OUT tracking fields to DailyAttendance
ALTER TABLE "DailyAttendance" ADD COLUMN "lastInTime" TIMESTAMP(3);
ALTER TABLE "DailyAttendance" ADD COLUMN "lastOutTime" TIMESTAMP(3);
ALTER TABLE "DailyAttendance" ADD COLUMN "currentlyInSchool" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DailyAttendance" ADD COLUMN "scanCount" INTEGER NOT NULL DEFAULT 0;
