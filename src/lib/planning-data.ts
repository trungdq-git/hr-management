import { z } from 'zod';
import { db } from './db';
import { calculateCapacity, effortSummary } from './capacity';
import { isoDate, monthDates, monthsFrom, monthStart } from './planning-dates';
import { monthSchema } from './planning-validation';
import type { PlanningData, HistoryEntry } from './planning-types';
import type { Prisma } from '@/generated/prisma/client';

export async function getPlanningData(start: string, count = 6, employeeId?: string): Promise<PlanningData> {
  const months = monthsFrom(start, count); const from = monthStart(start); const to = new Date(monthDates(months.at(-1)!).at(-1)!);
  const range = { gte: from, lte: to };
  const [employees, calendars, projects] = await Promise.all([
    db.employee.findMany({ where: employeeId ? { id: employeeId } : {}, orderBy: { code: 'asc' }, include: { capacitySettings: { where: { month: range } }, absences: { where: { date: range }, orderBy: { date: 'asc' } }, assignments: { include: { project: { select: { id: true, code: true, name: true } }, allocations: { where: { month: range } }, actuals: { where: { month: range } } } } } }),
    db.workingCalendar.findMany({ orderBy: { name: 'asc' }, include: { months: { where: { month: range } }, days: { where: { date: range }, orderBy: { date: 'asc' } } } }),
    db.project.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, status: true, startDate: true, endDate: true } }),
  ]);
  return {
    months,
    calendars: calendars.map(c => ({ id: c.id, name: c.name, months: c.months.map(m => ({ month: isoDate(m.month).slice(0, 7), standardDays: Number(m.standardDays), version: m.version })), days: c.days.map(d => ({ date: isoDate(d.date), workingFraction: Number(d.workingFraction), label: d.label ?? '' })) })),
    projects: projects.map(p => ({ ...p, startDate: isoDate(p.startDate), endDate: isoDate(p.endDate) })),
    employees: employees.map(e => {
      const efforts = e.assignments.flatMap(a => months.map(month => {
        const planned = a.allocations.find(v => isoDate(v.month).startsWith(month));
        const actual = a.actuals.find(v => isoDate(v.month).startsWith(month));
        return { projectId: a.project.id, projectName: a.project.name, projectCode: a.project.code, month, planned: planned ? Number(planned.plannedMm) : null, actual: actual ? Number(actual.actualMm) : null, plannedVersion: planned?.version ?? null, actualVersion: actual?.version ?? null };
      }));
      const absences = e.absences.map(a => ({ date: isoDate(a.date), fraction: Number(a.fraction), reason: a.reason, kind: a.kind, version: a.version }));
      return {
        id: e.id, code: e.code, name: e.name, position: e.position, location: e.location, status: e.status, joinDate: isoDate(e.joinDate), exitDate: e.exitDate ? isoDate(e.exitDate) : null, participationRate: Number(e.participationRate), efforts, absences,
        months: months.map(month => {
          const setting = e.capacitySettings.find(s => isoDate(s.month).startsWith(month));
          const calendarId = setting?.calendarId ?? e.calendarId;
          const rate = Number(setting?.participationRate ?? e.participationRate);
          const calendar = calendars.find(c => c.id === calendarId);
          const standard = calendar?.months.find(m => isoDate(m.month).startsWith(month));
          const details = calculateCapacity({ month, joinDate: isoDate(e.joinDate), exitDate: e.exitDate ? isoDate(e.exitDate) : null, participationRate: rate, standardDays: standard ? Number(standard.standardDays) : null, days: calendar?.days.filter(d => isoDate(d.date).startsWith(month)).map(d => ({ date: isoDate(d.date), workingFraction: Number(d.workingFraction) })) ?? [], absences: absences.filter(a => a.date.startsWith(month)) });
          const records = efforts.filter(f => f.month === month);
          return { month, ...details, ...effortSummary(details.capacity, records.flatMap(f => f.planned === null ? [] : [f.planned]), records.flatMap(f => f.actual === null ? [] : [f.actual])), actualRecorded: records.some(f => f.actual !== null), standardDays: standard ? Number(standard.standardDays) : null, calendarId, participationRate: rate, settingVersion: setting?.version ?? null };
        }),
      };
    }),
  };
}
const historyFilter = z.object({ employeeId: z.string().min(1).max(100).optional(), projectId: z.string().min(1).max(100).optional(), month: monthSchema.optional() });
export async function planningHistory(raw: unknown): Promise<HistoryEntry[]> {
  const input = historyFilter.parse(raw);
  const AND: Prisma.AuditLogWhereInput[] = [];
  for (const [key, value] of Object.entries(input)) if (value) AND.push({ OR: [{ after: { path: [key], equals: value } }, { before: { path: [key], equals: value } }] });
  const logs = await db.auditLog.findMany({ where: { entity: { in: ['MonthlyAllocation', 'MonthlyActualEffort'] }, AND }, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  return logs.map(l => ({ id: l.id, entity: l.entity, action: l.action, actor: l.actor.name, createdAt: l.createdAt.toISOString(), before: l.before as Record<string, unknown> | null, after: l.after as Record<string, unknown> | null }));
}
