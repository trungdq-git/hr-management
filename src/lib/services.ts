import { db } from './db';
import { employeeSchema, projectSchema } from './validation';
import { HttpError } from './auth';
import type { Prisma } from '@/generated/prisma/client';
function snapshot(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)); }
export async function saveEmployee(actorId: string, raw: unknown, id?: string) {
  const input = employeeSchema.parse(raw);
  const data = { ...input, joinDate: new Date(input.joinDate), exitDate: input.exitDate ? new Date(input.exitDate) : null };
  return db.$transaction(async tx => {
    const before = id ? await tx.employee.findUniqueOrThrow({ where: { id } }) : null;
    const after = id ? await tx.employee.update({ where: { id }, data }) : await tx.employee.create({ data });
    await tx.auditLog.create({ data: { actorId, entity: 'Employee', entityId: after.id, action: id ? 'UPDATE' : 'CREATE', ...(before ? { before: snapshot(before) } : {}), after: snapshot(after) } });
    return after;
  });
}
export async function saveProject(actorId: string, raw: unknown, id?: string) {
  const input = projectSchema.parse(raw);
  const data = { ...input, startDate: new Date(input.startDate), endDate: new Date(input.endDate) };
  return db.$transaction(async tx => {
    if (input.pmId) {
      const pm = await tx.employee.findUnique({ where: { id: input.pmId } });
      if (!pm || pm.position !== 'PM' || pm.status === 'RESIGNED') throw new HttpError(400, 'PM phải là nhân viên PM còn làm việc');
    }
    const before = id ? await tx.project.findUniqueOrThrow({ where: { id } }) : null;
    const after = id ? await tx.project.update({ where: { id }, data }) : await tx.project.create({ data });
    await tx.auditLog.create({ data: { actorId, entity: 'Project', entityId: after.id, action: id ? 'UPDATE' : 'CREATE', ...(before ? { before: snapshot(before) } : {}), after: snapshot(after) } });
    return after;
  });
}
