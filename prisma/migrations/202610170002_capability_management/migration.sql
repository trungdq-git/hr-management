ALTER TABLE "Skill" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmployeeSkill" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProjectSkillRequirement" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX "skill_name_case_insensitive" ON "Skill" (lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g')));
ALTER TABLE "Skill" ADD CONSTRAINT "skill_version" CHECK ("version" > 0);
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "employee_skill_version" CHECK ("version" > 0);
ALTER TABLE "ProjectSkillRequirement" ADD CONSTRAINT "requirement_version" CHECK ("version" > 0);
