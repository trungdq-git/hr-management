import { db } from './db';
import { HttpError } from './auth';
import { demandSchema, probabilitySchema } from './forecast-validation';
import { monthDates, monthStart } from './planning-dates';
import { scenarioLabels } from './forecast-types';
import type { Prisma } from '@/generated/prisma/client';
type Tx = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
function version(before: { version: number } | null, expected: number | null) { if ((before?.version ?? null) !== expected) throw new HttpError(409, 'Dữ liệu đã thay đổi. Tải lại trang trước khi lưu.'); }
async function audit(tx: Tx, actorId: string, entity: string, entityId: string, before: unknown, after: unknown) { await tx.auditLog.create({ data: { actorId, entity, entityId, action: before ? 'UPDATE' : 'CREATE', ...(before ? { before: json(before) } : {}), after: json(after) } }); }
export async function initializeScenarios(actorId: string) {
  return db.$transaction(async tx => {
    // Serialize concurrent initialization across requests, without changing existing scenarios.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(482041)`;
    for (const kind of ['CONSERVATIVE','BASE','OPTIMISTIC'] as const) {
      if (await tx.forecastScenario.findUnique({ where: { kind } })) continue;
      const row = await tx.forecastScenario.create({ data: { kind, name: scenarioLabels[kind] } });
      await audit(tx, actorId, 'ForecastScenario', row.id, null, row);
    }
    return tx.forecastScenario.findMany({ orderBy: { kind: 'asc' } });
  });
}
export async function saveDemand(actorId: string, raw: unknown) {
  const input = demandSchema.parse(raw); const month = monthStart(input.month);
  return db.$transaction(async tx => {
    for (const item of [...input.skills].sort((a,b) => a.skillId.localeCompare(b.skillId))) {
      await tx.$queryRaw`SELECT "id" FROM "Skill" WHERE "id" = ${item.skillId} FOR UPDATE`;
      const skill = await tx.skill.findUniqueOrThrow({ where: { id: item.skillId } });
      if (!skill.active) throw new HttpError(400, 'Không sử dụng kỹ năng đã lưu trữ trong demand');
    }
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${input.projectId} FOR UPDATE`;
    const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
    if (input.demandMm > 0 && (project.status === 'CANCELLED' || project.startDate > new Date(monthDates(input.month).at(-1)!) || project.endDate < month)) throw new HttpError(400, 'Demand dương phải nằm trong thời gian dự án và dự án chưa bị hủy');
    const key = { projectId_month: { projectId: input.projectId, month } };
    const before = await tx.monthlyProjectDemand.findUnique({ where: key, include: { skills: true } });
    version(before, input.expectedVersion);
    const demand = await tx.monthlyProjectDemand.upsert({ where: key, create: { projectId: input.projectId, month, demandMm: input.demandMm }, update: { demandMm: input.demandMm, version: { increment: 1 } } });
    await tx.monthlySkillDemand.deleteMany({ where: { demandId: demand.id } });
    if (input.skills.length) await tx.monthlySkillDemand.createMany({ data: input.skills.map(s => ({ demandId: demand.id, ...s })) });
    const after = await tx.monthlyProjectDemand.findUniqueOrThrow({ where: key, include: { skills: true } });
    await audit(tx, actorId, 'MonthlyProjectDemand', demand.id, before, after);
    return after;
  });
}
export async function saveProbability(actorId: string, raw: unknown) {
  const input = probabilitySchema.parse(raw);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${input.projectId} FOR UPDATE`;
    const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
    if (input.probability !== null && project.status !== 'PIPELINE') throw new HttpError(400, 'Xác suất chỉ áp dụng dự án Pipeline');
    const scenario = await tx.forecastScenario.findUniqueOrThrow({ where: { id: input.scenarioId } });
    const key = { scenarioId_projectId: { scenarioId: input.scenarioId, projectId: input.projectId } };
    const before = await tx.scenarioProjectProbability.findUnique({ where: key }); version(before, input.expectedVersion);
    const rank = { CONSERVATIVE: 0, BASE: 1, OPTIMISTIC: 2 };
    if (input.probability !== null) {
      const others = await tx.scenarioProjectProbability.findMany({ where: { projectId: input.projectId, scenarioId: { not: scenario.id }, probability: { not: null } }, include: { scenario: true } });
      if (others.some(other => rank[other.scenario.kind] < rank[scenario.kind] ? Number(other.probability) > input.probability! : Number(other.probability) < input.probability!)) throw new HttpError(400, 'Cần Conservative ≤ Base ≤ Optimistic cho các xác suất đã nhập');
    }
    const after = await tx.scenarioProjectProbability.upsert({ where: key, create: { scenarioId: scenario.id, projectId: project.id, probability: input.probability }, update: { probability: input.probability, version: { increment: 1 } } });
    await audit(tx, actorId, 'ScenarioProjectProbability', `${scenario.id}:${project.id}`, before, after);
    return after;
  });
}
