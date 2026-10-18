import { db } from './db';
import { getPlanningData } from './planning-data';
import { isoDate, monthDates, monthStart } from './planning-dates';
import { calculateForecast } from './forecast-engine';
import type { ForecastData, ForecastInput } from './forecast-types';
export type ForecastScope = { projectId?: string; position?: string; location?: string };
export async function getForecastData(start: string, count = 6, scope: ForecastScope = {}): Promise<ForecastData> {
  const planning = await getPlanningData(start, count);
  const [profiles, projects, skills, scenarios] = await Promise.all([
    db.employee.findMany({ select: { id: true, skills: true } }),
    db.project.findMany({ include: { requirements: { where: { active: true } }, demands: { where: { month: { gte: monthStart(start), lte: new Date(monthDates(planning.months.at(-1)!).at(-1)!) } }, include: { skills: true } } }, orderBy: { code: 'asc' } }),
    db.skill.findMany({ orderBy: { name: 'asc' } }),
    db.forecastScenario.findMany({ include: { probabilities: true }, orderBy: { kind: 'asc' } }),
  ]);
  const ratings = new Map(profiles.map(p => [p.id, p.skills]));
  const input: ForecastInput = {
    months: planning.months, skills,
    employees: planning.employees.filter(e => ratings.has(e.id) && (!scope.position || e.position === scope.position) && (!scope.location || e.location === scope.location) && (!scope.projectId || e.efforts.some(f => f.projectId === scope.projectId))).map(e => ({ id: e.id, code: e.code, name: e.name, joinDate: e.joinDate, exitDate: e.exitDate, months: e.months.map(m => ({ month: m.month, capacity: m.capacity })), efforts: e.efforts, ratings: ratings.get(e.id)! })),
    projects: projects.filter(p => !scope.projectId || p.id === scope.projectId).map(p => ({ id: p.id, code: p.code, name: p.name, status: p.status, startDate: isoDate(p.startDate), endDate: isoDate(p.endDate), requirements: p.requirements.map(r => ({ skillId: r.skillId, minProficiency: r.minProficiency })), demands: p.demands.map(d => ({ id: d.id, month: isoDate(d.month).slice(0,7), demandMm: Number(d.demandMm), version: d.version, skills: d.skills.map(s => ({ skillId: s.skillId, requiredMm: Number(s.requiredMm), minProficiency: s.minProficiency })) })) })),
    scenarios: scenarios.map(s => ({ id: s.id, name: s.name, kind: s.kind, probabilities: s.probabilities.map(p => ({ projectId: p.projectId, probability: p.probability === null ? null : Number(p.probability), version: p.version })) })),
  };
  const eligible = input.employees.filter(e => e.joinDate <= monthDates(start).at(-1)! && (!e.exitDate || e.exitDate >= `${start}-01`));
  const distribution = {
    projects: input.projects.map(p => ({ name: p.name, value: input.employees.reduce((sum,e) => sum + e.efforts.filter(f => f.projectId === p.id && f.month === start).reduce((s,f) => s + Math.round((f.planned ?? 0)*10000),0),0)/10000 })).filter(p => p.value > 0),
    skills: skills.filter(s => s.active).map(s => ({ name: s.name, value: eligible.filter(e => e.ratings.some(r => r.active && r.skillId === s.id)).length })),
  };
  return { months: input.months, projects: input.projects, skills, scenarios: input.scenarios, outputs: calculateForecast(input), distribution };
}
