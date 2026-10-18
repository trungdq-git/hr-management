import { db } from './db';
import { HttpError } from './auth';
import { absenceSchema, calendarMonthSchema, calendarSchema, effortSchema, settingsSchema } from './planning-validation';
import { isoDate, monthDates, monthStart } from './planning-dates';
import type { Prisma } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
function checkVersion(existing: { version: number } | null, expected: number | null) {
  if ((existing?.version ?? null) !== expected) throw new HttpError(409, 'Dữ liệu đã thay đổi. Tải lại trang trước khi lưu.');
}
async function audit(tx: Tx, actorId: string, entity: string, entityId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: { actorId, entity, entityId, action: before ? 'UPDATE' : 'CREATE', ...(before ? { before: json(before) } : {}), after: json(after) } });
}
async function lockEmployee(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Employee" WHERE "id" = ${id} FOR UPDATE`;
  return tx.employee.findUniqueOrThrow({ where: { id } });
}
export async function createCalendar(actorId: string, raw: unknown) {
  const data = calendarSchema.parse(raw);
  return db.$transaction(async tx => {
    const result = await tx.workingCalendar.create({ data });
    await audit(tx, actorId, 'WorkingCalendar', result.id, null, result);
    return result;
  });
}
export async function saveCalendarMonth(actorId: string, raw: unknown) {
  const input = calendarMonthSchema.parse(raw);
  const month = monthStart(input.month);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WorkingCalendar" WHERE "id" = ${input.calendarId} FOR UPDATE`;
    await tx.workingCalendar.findUniqueOrThrow({ where: { id: input.calendarId } });
    const key = { calendarId_month: { calendarId: input.calendarId, month } };
    const before = await tx.calendarMonth.findUnique({ where: key });
    checkVersion(before, input.expectedVersion);
    const range = { calendarId: input.calendarId, date: { gte: month, lte: new Date(monthDates(input.month).at(-1)!) } };
    const oldDays = await tx.calendarDay.findMany({ where: range, orderBy: { date: 'asc' } });
    const result = await tx.calendarMonth.upsert({ where: key, create: { calendarId: input.calendarId, month, standardDays: input.standardDays }, update: { standardDays: input.standardDays, version: { increment: 1 } } });
    // Full-month replacement is atomic; audit retains every previous day and label.
    await tx.calendarDay.deleteMany({ where: range });
    await tx.calendarDay.createMany({ data: input.days.map(d => ({ calendarId: input.calendarId, date: new Date(d.date), workingFraction: d.workingFraction, label: d.label || null })) });
    await audit(tx, actorId, 'CalendarMonth', `${input.calendarId}:${input.month}`, before ? { ...before, days: oldDays } : null, { ...result, days: input.days });
    return result;
  });
}
export async function saveCapacitySettings(actorId: string, raw: unknown) {
  const input = settingsSchema.parse(raw); const month = monthStart(input.month);
  return db.$transaction(async tx => {
    await tx.workingCalendar.findUniqueOrThrow({ where: { id: input.calendarId } });
    const results = [];
    for (const entry of [...input.employees].sort((a, b) => a.employeeId.localeCompare(b.employeeId))) {
      await lockEmployee(tx, entry.employeeId);
      const key = { employeeId_month: { employeeId: entry.employeeId, month } };
      const before = await tx.employeeCapacitySetting.findUnique({ where: key });
      checkVersion(before, entry.expectedVersion);
      const data = { calendarId: input.calendarId, participationRate: entry.participationRate };
      const after = await tx.employeeCapacitySetting.upsert({ where: key, create: { employeeId: entry.employeeId, month, ...data }, update: { ...data, version: { increment: 1 } } });
      await audit(tx, actorId, 'EmployeeCapacitySetting', `${entry.employeeId}:${input.month}`, before, after);
      results.push(after);
    }
    return results;
  }, { timeout: 30000 });
}
export async function saveAbsence(actorId: string, raw: unknown) {
  const input = absenceSchema.parse(raw);
  return db.$transaction(async tx => {
    const employee = await lockEmployee(tx, input.employeeId);
    if (input.fraction > 0 && (input.date < isoDate(employee.joinDate) || (employee.exitDate && input.date > isoDate(employee.exitDate)))) throw new HttpError(400, 'Ngày nghỉ nằm ngoài thời gian làm việc của nhân viên');
    const key = { employeeId_date: { employeeId: input.employeeId, date: new Date(input.date) } };
    const before = await tx.employeeAbsence.findUnique({ where: key });
    checkVersion(before, input.expectedVersion);
    if (input.fraction === 0) {
      if (!before) return { cleared: true };
      const after = await tx.employeeAbsence.update({ where: key, data: { fraction: 0, version: { increment: 1 } } });
      await audit(tx, actorId, 'EmployeeAbsence', `${input.employeeId}:${input.date}`, before, { ...after, cleared: true });
      return { cleared: true };
    }
    const data = { fraction: input.fraction, reason: input.reason, kind: input.kind };
    const after = await tx.employeeAbsence.upsert({ where: key, create: { employeeId: input.employeeId, date: new Date(input.date), ...data }, update: { ...data, version: { increment: 1 } } });
    await audit(tx, actorId, 'EmployeeAbsence', `${input.employeeId}:${input.date}`, before, after);
    return after;
  });
}
export async function saveEffort(actorId: string, raw: unknown) {
  return db.$transaction(tx => saveEffortInTransaction(tx, actorId, raw));
}
export async function saveEffortInTransaction(tx: Tx, actorId: string, raw: unknown) {
  const input = effortSchema.parse(raw); const month = monthStart(input.month);
    const employee = await lockEmployee(tx, input.employeeId);
    const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
    const lastDate = new Date(monthDates(input.month).at(-1)!);
    if (input.mm > 0) {
      if (employee.joinDate > lastDate || (employee.exitDate && employee.exitDate < month)) throw new HttpError(400, 'Tháng nằm ngoài thời gian làm việc của nhân viên');
      if (project.startDate > lastDate || project.endDate < month) throw new HttpError(400, 'Tháng nằm ngoài thời gian dự án');
      const overlapStart = Math.max(employee.joinDate.getTime(), project.startDate.getTime(), month.getTime());
      const overlapEnd = Math.min(employee.exitDate?.getTime() ?? Infinity, project.endDate.getTime(), lastDate.getTime());
      if (overlapStart > overlapEnd) throw new HttpError(400, 'Nhân viên và dự án không có ngày giao nhau trong tháng');
      if (project.status === 'PIPELINE' || (input.kind === 'PLANNED' && project.status === 'CANCELLED')) throw new HttpError(400, 'Không ghi effort dương cho Pipeline hoặc Planned cho dự án đã hủy');
    }
    const assignment = await tx.projectAssignment.upsert({ where: { employeeId_projectId: { employeeId: employee.id, projectId: project.id } }, create: { employeeId: employee.id, projectId: project.id }, update: {} });
    const key = { assignmentId_month: { assignmentId: assignment.id, month } };
    const before = input.kind === 'PLANNED' ? await tx.monthlyAllocation.findUnique({ where: key }) : await tx.monthlyActualEffort.findUnique({ where: key });
    checkVersion(before, input.expectedVersion);
    const after = input.kind === 'PLANNED'
      ? await tx.monthlyAllocation.upsert({ where: key, create: { assignmentId: assignment.id, month, plannedMm: input.mm }, update: { plannedMm: input.mm, version: { increment: 1 } } })
      : await tx.monthlyActualEffort.upsert({ where: key, create: { assignmentId: assignment.id, month, actualMm: input.mm }, update: { actualMm: input.mm, version: { increment: 1 } } });
    const context = { employeeId: employee.id, employeeName: employee.name, projectId: project.id, projectName: project.name, month: input.month, kind: input.kind };
    await audit(tx, actorId, input.kind === 'PLANNED' ? 'MonthlyAllocation' : 'MonthlyActualEffort', after.id, before ? { ...before, ...context } : null, { ...after, ...context });
    return after;
}
