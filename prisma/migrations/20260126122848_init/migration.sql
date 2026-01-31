/*
  Warnings:

  - You are about to drop the column `absenceCutoffTime` on the `School` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "School" DROP COLUMN "absenceCutoffTime",
ADD COLUMN     "absenceCutoffMinutes" INTEGER NOT NULL DEFAULT 180;
