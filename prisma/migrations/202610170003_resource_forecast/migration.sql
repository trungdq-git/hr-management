ALTER TABLE "MonthlyProjectDemand" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MonthlyProjectDemand" ADD CONSTRAINT "demand_version" CHECK ("version" > 0);
CREATE UNIQUE INDEX "ForecastScenario_kind_key" ON "ForecastScenario"("kind");
ALTER TABLE "ScenarioProjectProbability" ALTER COLUMN "probability" DROP NOT NULL;
ALTER TABLE "ScenarioProjectProbability" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ScenarioProjectProbability" ADD CONSTRAINT "probability_version" CHECK ("version" > 0);
CREATE TABLE "MonthlySkillDemand" (
 "demandId" TEXT NOT NULL,
 "skillId" TEXT NOT NULL,
 "requiredMm" DECIMAL(12,4) NOT NULL,
 "minProficiency" INTEGER NOT NULL,
 CONSTRAINT "MonthlySkillDemand_pkey" PRIMARY KEY ("demandId", "skillId"),
 CONSTRAINT "MonthlySkillDemand_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "MonthlyProjectDemand"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MonthlySkillDemand_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "monthly_skill_valid" CHECK ("requiredMm" > 0 AND "minProficiency" BETWEEN 1 AND 5)
);
-- Deferred cross-row invariant: a whole month + its work profiles is saved atomically.
CREATE FUNCTION check_monthly_skill_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE demand_key TEXT; total NUMERIC; limit_mm NUMERIC;
BEGIN
 IF TG_TABLE_NAME = 'MonthlyProjectDemand' THEN demand_key := NEW."id";
 ELSE demand_key := CASE WHEN TG_OP = 'DELETE' THEN OLD."demandId" ELSE NEW."demandId" END;
 END IF;
 SELECT "demandMm" INTO limit_mm FROM "MonthlyProjectDemand" WHERE "id" = demand_key FOR UPDATE;
 SELECT COALESCE(SUM("requiredMm"), 0) INTO total FROM "MonthlySkillDemand" WHERE "demandId" = demand_key;
 IF total > limit_mm THEN RAISE EXCEPTION 'Monthly skill MM exceeds project demand' USING ERRCODE = '23514'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER monthly_skill_sum AFTER INSERT OR UPDATE OR DELETE ON "MonthlySkillDemand" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_monthly_skill_total();
CREATE CONSTRAINT TRIGGER monthly_demand_skill_sum AFTER INSERT OR UPDATE ON "MonthlyProjectDemand" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_monthly_skill_total();
