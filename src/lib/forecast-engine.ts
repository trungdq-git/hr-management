import { allocateFlow, apportion } from './max-flow';
import { monthDates } from './planning-dates';
import type { ForecastInput, ForecastMonth, ForecastEmployee, ForecastProject, ForecastScenarioData, ScenarioForecast } from './forecast-types';

const units = (mm: number) => Math.round(mm * 10000);
const mm = (value: number) => value / 10000;
const sum = (values: number[]) => values.reduce((s, n) => s + n, 0);
export function weightedMm(demand: number, probability: number) {
  return mm(Number((BigInt(units(demand)) * BigInt(Math.round(probability * 10000)) + 5000n) / 10000n));
}
type Task = { project: ForecastProject; skillId: string | null; minProficiency: number; units: number };
function forecastMonth(input: ForecastInput, scenario: ForecastScenarioData, month: string): ForecastMonth {
  const last = monthDates(month).at(-1)!;
  const projects = input.projects.filter(p => ['ACTIVE','CONFIRMED','PIPELINE'].includes(p.status) && p.startDate <= last && p.endDate >= `${month}-01`);
  const missingCapacity = input.employees.filter(e => e.months.find(m => m.month === month)?.capacity == null).map(e => e.code);
  const knownSupply = mm(sum(input.employees.map(e => units(e.months.find(m => m.month === month)?.capacity ?? 0))));
  const missingDemand: string[] = []; const missingProbability: string[] = []; const unprofiledProjects: string[] = []; const warnings: string[] = [];
  let confirmed = 0; let pipeline = 0; let weighted = 0; const tasks: Task[] = [];
  const activeSkills = new Set(input.skills.filter(s => s.active).map(s => s.id));
  for (const project of projects) {
    if ((project.startDate.startsWith(month) && !project.startDate.endsWith('-01')) || (project.endDate.startsWith(month) && project.endDate !== last)) warnings.push(`${project.code}: dự án bắt đầu/kết thúc giữa tháng; kiểm tra lịch ngày trước khi chốt phân bổ`);
    const demand = project.demands.find(d => d.month === month);
    const probability = scenario.probabilities.find(p => p.projectId === project.id)?.probability;
    if (!demand) missingDemand.push(project.code);
    if (project.status === 'PIPELINE' && probability == null) missingProbability.push(project.code);
    const allocated = sum(input.employees.flatMap(e => e.efforts.filter(f => f.projectId === project.id && f.month === month).map(f => units(f.planned ?? 0))));
    if (demand && allocated > units(demand.demandMm)) warnings.push(`${project.code}: Planned vượt demand tháng`);
    if (!demand) continue;
    const raw = units(demand.demandMm);
    if (project.status === 'PIPELINE') { pipeline += raw; if (probability != null) weighted += units(weightedMm(demand.demandMm, probability)); }
    else confirmed += raw;
    if (project.status === 'PIPELINE' && probability == null) continue;
    const target = project.status === 'PIPELINE' ? units(weightedMm(demand.demandMm, probability!)) : raw;
    const skillUnits = demand.skills.map(s => units(s.requiredMm));
    const profiles = [...demand.skills.map(s => ({ skillId: s.skillId as string | null, minProficiency: s.minProficiency, units: units(s.requiredMm) })), { skillId: null, minProficiency: 1, units: raw - sum(skillUnits) }].filter(p => p.units > 0);
    const portions = apportion(target, profiles.map(p => p.units));
    profiles.forEach((p, i) => {
      if (portions[i] <= 0) return;
      if ((!p.skillId && !project.requirements.length) || (p.skillId && !activeSkills.has(p.skillId)) || project.requirements.some(r => !activeSkills.has(r.skillId))) unprofiledProjects.push(project.code);
      tasks.push({ project, skillId: p.skillId, minProficiency: p.minProficiency, units: portions[i] });
    });
  }
  const outside = input.employees.flatMap(e => e.efforts.filter(f => f.month === month && (f.planned ?? 0) > 0 && !projects.some(p => p.id === f.projectId)));
  if (outside.length) warnings.push('Có Planned ngoài tập dự án forecast; vẫn giữ ngân sách capacity cho phần đã phân bổ đó');
  for (const employee of input.employees) {
    const capacity = employee.months.find(m => m.month === month)?.capacity;
    const planned = sum(employee.efforts.filter(f => f.month === month).map(f => units(f.planned ?? 0)));
    if (capacity != null && planned > units(capacity)) warnings.push(`${employee.code}: tổng Planned vượt Capacity`);
  }
  const missingConfirmed = projects.some(p => p.status !== 'PIPELINE' && !p.demands.some(d => d.month === month));
  const missingPipeline = projects.some(p => p.status === 'PIPELINE' && !p.demands.some(d => d.month === month));
  const supply = missingCapacity.length ? null : knownSupply;
  const confirmedMm = missingConfirmed ? null : mm(confirmed);
  const pipelineMm = missingPipeline ? null : mm(pipeline);
  const weightedPipeline = missingPipeline || missingProbability.length ? null : mm(weighted);
  const expectedDemand = confirmedMm === null || weightedPipeline === null ? null : mm(confirmed + weighted);
  const gap = supply === null || expectedDemand === null ? null : mm(units(supply) - units(expectedDemand));
  const row: ForecastMonth = { month, knownSupply, supply, allocated: mm(sum(input.employees.flatMap(e => e.efforts.filter(f => f.month === month).map(f => units(f.planned ?? 0))))), actual: mm(sum(input.employees.flatMap(e => e.efforts.filter(f => f.month === month).map(f => units(f.actual ?? 0))))), knownConfirmed: mm(confirmed), confirmed: confirmedMm, knownPipeline: mm(pipeline), pipeline: pipelineMm, knownWeightedPipeline: mm(weighted), weightedPipeline, expectedDemand, gap, missingCapacity, missingDemand, missingProbability, unprofiledProjects: [...new Set(unprofiledProjects)], warnings, skillGap: null, capabilityShortfall: null, staffingGap: null, transfers: [], profileGaps: [], recruitmentMm: null, nominalHires: null };
  if (gap === null) return row;
  const shortage = Math.max(0, -units(gap));
  if (unprofiledProjects.length) { row.recruitmentMm = mm(shortage); return row; }
  const eligible = (employee: ForecastEmployee, task: Task) => {
    const start = [employee.joinDate, task.project.startDate, `${month}-01`].sort().at(-1)!;
    const end = [employee.exitDate ?? '9999-12-31', task.project.endDate, last].sort()[0];
    if (start > end) return false;
    const criteria = [...task.project.requirements, ...(task.skillId ? [{ skillId: task.skillId, minProficiency: task.minProficiency }] : [])];
    return criteria.every(c => activeSkills.has(c.skillId) && employee.ratings.some(r => r.active && r.skillId === c.skillId && r.proficiency >= c.minProficiency));
  };
  const allSupply = input.employees.map(employee => ({ id: employee.id, employee, units: units(employee.months.find(m => m.month === month)?.capacity ?? 0) }));
  const flexible = allocateFlow(allSupply, tasks, (s, t) => eligible(s.employee, t));
  const targetTotal = sum(tasks.map(t => t.units));
  row.capabilityShortfall = mm(targetTotal - flexible.total);
  row.skillGap = mm(Math.max(0, targetTotal - flexible.total - shortage));
  row.recruitmentMm = row.capabilityShortfall; row.nominalHires = Math.ceil(row.recruitmentMm);
  row.profileGaps = tasks.flatMap((task, i) => flexible.remaining[i] > 0 ? [{ projectId: task.project.id, projectName: task.project.name, skillId: task.skillId, minProficiency: task.minProficiency, requiredSkills: task.project.requirements, mm: mm(flexible.remaining[i]) }] : []);
  const committed = allSupply.flatMap(s => {
    const entries = s.employee.efforts.filter(f => f.month === month && (f.planned ?? 0) > 0);
    const planned = entries.map(f => units(f.planned!)); const total = sum(planned);
    const budgets = total > s.units ? apportion(s.units, planned) : planned;
    return entries.map((e, i) => ({ id: `${s.id}:${e.projectId}`, employee: s.employee, projectId: e.projectId, units: budgets[i] }));
  });
  const reserved = allocateFlow(committed, tasks, (s, t) => s.projectId === t.project.id && eligible(s.employee, t));
  const free = allSupply.map(s => ({ ...s, units: Math.max(0, s.units - sum(s.employee.efforts.filter(f => f.month === month).map(f => units(f.planned ?? 0)))) }));
  const residual = tasks.map((t, i) => ({ ...t, units: reserved.remaining[i] }));
  const movable = allocateFlow(free, residual, (s, t) => eligible(s.employee, t));
  row.staffingGap = mm(targetTotal - reserved.total - movable.total);
  row.transfers = movable.assignments.map(a => ({ employeeId: a.supply.employee.id, employeeName: a.supply.employee.name, employeeCode: a.supply.employee.code, projectId: residual[a.taskIndex].project.id, projectName: residual[a.taskIndex].project.name, skillId: residual[a.taskIndex].skillId, mm: mm(a.units), freeMm: mm(a.supply.units) }));
  return row;
}
export function calculateForecast(input: ForecastInput): ScenarioForecast[] {
  return input.scenarios.map(scenario => {
    const months = input.months.map(month => forecastMonth(input, scenario, month));
    const peak = months.some(m => m.recruitmentMm === null) ? null : Math.max(0, ...months.map(m => m.recruitmentMm!));
    return { scenarioId: scenario.id, kind: scenario.kind, months, peakRecruitmentMm: peak, nominalHires: peak === null || months.some(m => m.unprofiledProjects.length > 0) ? null : Math.ceil(peak) };
  });
}
