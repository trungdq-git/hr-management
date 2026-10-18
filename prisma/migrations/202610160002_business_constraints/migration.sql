ALTER TABLE "Employee" ADD CONSTRAINT "employee_level" CHECK ("level" BETWEEN 1 AND 6), ADD CONSTRAINT "employee_experience" CHECK ("experience" >= 0 AND "experience" <= 60), ADD CONSTRAINT "employee_rate" CHECK ("participationRate" BETWEEN 0 AND 1), ADD CONSTRAINT "employee_dates" CHECK ("exitDate" IS NULL OR "exitDate" >= "joinDate"), ADD CONSTRAINT "resigned_requires_exit" CHECK ("status" <> 'RESIGNED' OR "exitDate" IS NOT NULL);
CREATE UNIQUE INDEX "employee_email_case_insensitive" ON "Employee" (lower("email"));
CREATE UNIQUE INDEX "user_email_case_insensitive" ON "User" (lower("email"));
ALTER TABLE "Project" ADD CONSTRAINT "project_mm" CHECK ("contractedMm" >= 0 AND "forecastMm" >= 0), ADD CONSTRAINT "project_dates" CHECK ("endDate" >= "startDate");
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "skill_proficiency" CHECK ("proficiency" BETWEEN 1 AND 5);
ALTER TABLE "ProjectSkillRequirement" ADD CONSTRAINT "requirement_valid" CHECK ("minProficiency" BETWEEN 1 AND 5 AND "requiredMm" >= 0);
ALTER TABLE "MonthlyAllocation" ADD CONSTRAINT "allocation_mm" CHECK ("plannedMm" >= 0), ADD CONSTRAINT "allocation_month" CHECK (extract(day FROM "month") = 1);
ALTER TABLE "MonthlyActualEffort" ADD CONSTRAINT "actual_mm" CHECK ("actualMm" >= 0), ADD CONSTRAINT "actual_month" CHECK (extract(day FROM "month") = 1);
ALTER TABLE "CalendarDay" ADD CONSTRAINT "calendar_fraction" CHECK ("workingFraction" BETWEEN 0 AND 1);
ALTER TABLE "CalendarMonth" ADD CONSTRAINT "standard_days" CHECK ("standardDays" > 0 AND "standardDays" <= 31), ADD CONSTRAINT "calendar_month" CHECK (extract(day FROM "month") = 1);
ALTER TABLE "EmployeeAbsence" ADD CONSTRAINT "absence_fraction" CHECK ("fraction" > 0 AND "fraction" <= 1);
ALTER TABLE "MonthlyProjectDemand" ADD CONSTRAINT "demand_mm" CHECK ("demandMm" >= 0), ADD CONSTRAINT "demand_month" CHECK (extract(day FROM "month") = 1);
ALTER TABLE "ScenarioProjectProbability" ADD CONSTRAINT "probability_range" CHECK ("probability" BETWEEN 0 AND 1);

-- Audit entries are append-only, including accidental writes from application code.
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
