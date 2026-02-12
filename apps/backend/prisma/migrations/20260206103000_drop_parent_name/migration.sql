-- Move legacy parentName values into fatherName where needed, then drop parentName.
UPDATE "Student"
SET "fatherName" = "parentName"
WHERE "fatherName" IS NULL
  AND "parentName" IS NOT NULL;

ALTER TABLE "Student" DROP COLUMN "parentName";
