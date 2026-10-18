CREATE TYPE "AbsenceKind" AS ENUM ('LEAVE', 'UNAVAILABLE');
ALTER TABLE "CalendarMonth" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmployeeAbsence" ADD COLUMN "kind" "AbsenceKind" NOT NULL DEFAULT 'LEAVE', ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MonthlyAllocation" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MonthlyActualEffort" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "EmployeeCapacitySetting" (
  "employeeId" TEXT NOT NULL,
  "month" DATE NOT NULL,
  "calendarId" TEXT NOT NULL,
  "participationRate" DECIMAL(5,4) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "EmployeeCapacitySetting_pkey" PRIMARY KEY ("employeeId", "month"),
  CONSTRAINT "EmployeeCapacitySetting_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeCapacitySetting_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "capacity_setting_month" CHECK (extract(day FROM "month") = 1),
  CONSTRAINT "capacity_setting_rate" CHECK ("participationRate" BETWEEN 0 AND 1),
  CONSTRAINT "capacity_setting_version" CHECK ("version" > 0)
);
CREATE INDEX "EmployeeCapacitySetting_month_idx" ON "EmployeeCapacitySetting"("month");
ALTER TABLE "CalendarMonth" ADD CONSTRAINT "calendar_version" CHECK ("version" > 0);
ALTER TABLE "EmployeeAbsence" ADD CONSTRAINT "absence_version" CHECK ("version" > 0);
-- Keep a zero-fraction tombstone on cancellation to preserve monotonic edit versions.
ALTER TABLE "EmployeeAbsence" DROP CONSTRAINT "absence_fraction";
ALTER TABLE "EmployeeAbsence" ADD CONSTRAINT "absence_fraction" CHECK ("fraction" BETWEEN 0 AND 1);
ALTER TABLE "MonthlyAllocation" ADD CONSTRAINT "allocation_version" CHECK ("version" > 0);
ALTER TABLE "MonthlyActualEffort" ADD CONSTRAINT "actual_version" CHECK ("version" > 0);
CREATE INDEX "MonthlyActualEffort_month_idx" ON "MonthlyActualEffort"("month");
-- Make the capacity configuration of existing months explicit when upgrading Phase 1 data.
INSERT INTO "EmployeeCapacitySetting" ("employeeId", "month", "calendarId", "participationRate")
SELECT e."id", cm."month", e."calendarId", e."participationRate"
FROM "Employee" e JOIN "CalendarMonth" cm ON cm."calendarId" = e."calendarId";
