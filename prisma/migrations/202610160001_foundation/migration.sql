-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('PM', 'BrSE', 'TL', 'Developer', 'Tester');

-- CreateEnum
CREATE TYPE "Location" AS ENUM ('ONSITE', 'OFFSHORE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'PROBATION', 'ON_LEAVE', 'RESIGNED');

-- CreateEnum
CREATE TYPE "Jlpt" AS ENUM ('N1', 'N2', 'N3', 'N4', 'N5', 'NONE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PIPELINE', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'CLOUD', 'DATABASE', 'TESTING', 'AI_TOOLS', 'MANAGEMENT', 'JAPANESE');

-- CreateEnum
CREATE TYPE "ScenarioKind" AS ENUM ('CONSERVATIVE', 'BASE', 'OPTIMISTIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "level" INTEGER NOT NULL,
    "joinDate" DATE NOT NULL,
    "exitDate" DATE,
    "experience" DECIMAL(5,2) NOT NULL,
    "location" "Location" NOT NULL DEFAULT 'OFFSHORE',
    "jlpt" "Jlpt" NOT NULL DEFAULT 'NONE',
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "participationRate" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "calendarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" INTEGER NOT NULL,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("employeeId","skillId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "pmId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PIPELINE',
    "contractedMm" DECIMAL(12,4) NOT NULL,
    "forecastMm" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSkillRequirement" (
    "projectId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "minProficiency" INTEGER NOT NULL,
    "requiredMm" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "ProjectSkillRequirement_pkey" PRIMARY KEY ("projectId","skillId")
);

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyAllocation" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "plannedMm" DECIMAL(12,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyActualEffort" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "actualMm" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "MonthlyActualEffort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingCalendar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "WorkingCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDay" (
    "calendarId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "workingFraction" DECIMAL(5,4) NOT NULL,
    "label" TEXT,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("calendarId","date")
);

-- CreateTable
CREATE TABLE "CalendarMonth" (
    "calendarId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "standardDays" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "CalendarMonth_pkey" PRIMARY KEY ("calendarId","month")
);

-- CreateTable
CREATE TABLE "EmployeeAbsence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fraction" DECIMAL(5,4) NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "EmployeeAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyProjectDemand" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "demandMm" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "MonthlyProjectDemand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ScenarioKind" NOT NULL,

    CONSTRAINT "ForecastScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioProjectProbability" (
    "scenarioId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "ScenarioProjectProbability_pkey" PRIMARY KEY ("scenarioId","projectId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_position_status_location_idx" ON "Employee"("position", "status", "location");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_startDate_endDate_idx" ON "Project"("status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAssignment_employeeId_projectId_key" ON "ProjectAssignment"("employeeId", "projectId");

-- CreateIndex
CREATE INDEX "MonthlyAllocation_month_idx" ON "MonthlyAllocation"("month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAllocation_assignmentId_month_key" ON "MonthlyAllocation"("assignmentId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyActualEffort_assignmentId_month_key" ON "MonthlyActualEffort"("assignmentId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingCalendar_name_key" ON "WorkingCalendar"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAbsence_employeeId_date_key" ON "EmployeeAbsence"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyProjectDemand_projectId_month_key" ON "MonthlyProjectDemand"("projectId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastScenario_name_key" ON "ForecastScenario"("name");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_pmId_fkey" FOREIGN KEY ("pmId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkillRequirement" ADD CONSTRAINT "ProjectSkillRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkillRequirement" ADD CONSTRAINT "ProjectSkillRequirement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyAllocation" ADD CONSTRAINT "MonthlyAllocation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ProjectAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyActualEffort" ADD CONSTRAINT "MonthlyActualEffort_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ProjectAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarMonth" ADD CONSTRAINT "CalendarMonth_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAbsence" ADD CONSTRAINT "EmployeeAbsence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyProjectDemand" ADD CONSTRAINT "MonthlyProjectDemand_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioProjectProbability" ADD CONSTRAINT "ScenarioProjectProbability_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "ForecastScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioProjectProbability" ADD CONSTRAINT "ScenarioProjectProbability_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
