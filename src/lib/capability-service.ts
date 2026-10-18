import { db } from './db';
import { HttpError } from './auth';
import { ratingSchema, requirementSchema, skillSchema } from './capability-validation';
import type { Prisma } from '@/generated/prisma/client';
type Tx = Prisma.TransactionClient;
const snapshot = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
function version(existing: { version: number } | null, expected: number | null) {
  if ((existing?.version ?? null) !== expected) throw new HttpError(409, 'Dữ liệu đã thay đổi. Tải lại trang trước khi lưu.');
}
async function audit(tx: Tx, actorId: string, entity: string, entityId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: { actorId, entity, entityId, action: before ? 'UPDATE' : 'CREATE', ...(before ? { before: snapshot(before) } : {}), after: snapshot(after) } });
}
async function lockSkill(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Skill" WHERE "id" = ${id} FOR UPDATE`;
  return tx.skill.findUniqueOrThrow({ where: { id } });
}
export async function saveSkill(actorId: string, raw: unknown) {
  const input = skillSchema.parse(raw);
  try {
    return await db.$transaction(async tx => {
      const before = input.id ? await lockSkill(tx, input.id) : null;
      version(before, input.expectedVersion);
      if (before && !input.active && await tx.projectSkillRequirement.count({ where: { skillId: before.id, active: true } })) throw new HttpError(409, 'Kỹ năng còn được yêu cầu trong dự án. Gỡ các yêu cầu đó trước khi lưu trữ.');
      if (before && !input.active && await tx.monthlySkillDemand.count({ where: { skillId: before.id } })) throw new HttpError(409, 'Kỹ năng còn dùng trong demand tháng. Cập nhật các demand đó trước khi lưu trữ.');
      const data = { name: input.name, category: input.category, active: input.active };
      const after = input.id ? await tx.skill.update({ where: { id: input.id }, data: { ...data, version: { increment: 1 } } }) : await tx.skill.create({ data });
      await audit(tx, actorId, 'Skill', after.id, before, after);
      return after;
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new HttpError(409, 'Tên kỹ năng đã tồn tại (không phân biệt hoa/thường).');
    throw error;
  }
}
export async function saveRating(actorId: string, raw: unknown) {
  const input = ratingSchema.parse(raw);
  return db.$transaction(async tx => {
    const skill = await lockSkill(tx, input.skillId);
    if (input.active && !skill.active) throw new HttpError(400, 'Kỹ năng đã được lưu trữ. Khôi phục danh mục trước khi đánh giá.');
    await tx.$queryRaw`SELECT "id" FROM "Employee" WHERE "id" = ${input.employeeId} FOR UPDATE`;
    await tx.employee.findUniqueOrThrow({ where: { id: input.employeeId } });
    const key = { employeeId_skillId: { employeeId: input.employeeId, skillId: input.skillId } };
    const before = await tx.employeeSkill.findUnique({ where: key });
    version(before, input.expectedVersion);
    const data = { proficiency: input.proficiency, active: input.active };
    const after = await tx.employeeSkill.upsert({ where: key, create: { employeeId: input.employeeId, skillId: input.skillId, ...data }, update: { ...data, version: { increment: 1 } } });
    await audit(tx, actorId, 'EmployeeSkill', `${input.employeeId}:${input.skillId}`, before, after);
    return after;
  });
}
export async function saveRequirement(actorId: string, raw: unknown) {
  const input = requirementSchema.parse(raw);
  return db.$transaction(async tx => {
    const skill = await lockSkill(tx, input.skillId);
    if (input.active && !skill.active) throw new HttpError(400, 'Không thêm yêu cầu cho kỹ năng đã lưu trữ');
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${input.projectId} FOR UPDATE`;
    await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
    const key = { projectId_skillId: { projectId: input.projectId, skillId: input.skillId } };
    const before = await tx.projectSkillRequirement.findUnique({ where: key });
    version(before, input.expectedVersion);
    const data = { minProficiency: input.minProficiency, requiredMm: input.requiredMm, active: input.active };
    const after = await tx.projectSkillRequirement.upsert({ where: key, create: { projectId: input.projectId, skillId: input.skillId, ...data }, update: { ...data, version: { increment: 1 } } });
    await audit(tx, actorId, 'ProjectSkillRequirement', `${input.projectId}:${input.skillId}`, before, after);
    return after;
  });
}
