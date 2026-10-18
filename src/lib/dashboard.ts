import { db } from './db';
import { getPlanningData } from './planning-data';
import { monthDates, monthStart } from './planning-dates';
import { roundMm } from './mm';
import type { Position, Location } from '@/generated/prisma/client';
export type DashboardFilters={month:string;position?:Position;location?:Location;project?:string};
export async function dashboardData(filters:DashboardFilters) {
  const data = await getPlanningData(filters.month, 1);
  const last = monthDates(filters.month).at(-1)!; const first = `${filters.month}-01`;
  const employees = data.employees.filter(e => e.joinDate <= last && (!e.exitDate || e.exitDate >= first) && (!filters.position || e.position === filters.position) && (!filters.location || e.location === filters.location) && (!filters.project || e.efforts.some(f => f.projectId === filters.project)));
  const projects = await db.project.findMany({ where: { ...(filters.project ? { id: filters.project } : {}), ...(filters.position || filters.location ? { assignments: { some: { employeeId: { in: employees.map(e => e.id) } } } } : {}), startDate: { lte: new Date(last) }, endDate: { gte: monthStart(filters.month) } }, include: { pm: { select: { name: true } }, _count: { select: { assignments: true } } }, orderBy: { code: 'asc' } });
  const summaries = employees.map(e => e.months[0]);
  const sum = (values: number[]) => roundMm(values.reduce((s, n) => s + n, 0));
  const configured = summaries.filter(s => s.capacity !== null).length;
  return { employees, projects, totalCapacity: sum(summaries.map(s => s.capacity ?? 0)), totalAllocated: sum(summaries.map(s => s.allocated)), totalActual: sum(summaries.map(s => s.actual)), overallocated: summaries.filter(s => s.overallocated).length, unallocated: summaries.filter(s => s.unallocated).length, configured, complete: configured === employees.length && employees.length > 0 };
}
