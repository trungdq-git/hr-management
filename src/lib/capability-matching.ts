import type { CapabilityEmployee, CatalogSkill, ResourceFilters, SkillCriterion, ResourceMatch } from './capability-types';
import { monthDates } from './planning-dates';
export function matchesJlpt(actual: string, minimum: string) {
  if (minimum === 'ANY') return true;
  if (minimum === 'NONE') return actual === 'NONE';
  const order = ['N1','N2','N3','N4','N5'];
  return order.includes(actual) && order.includes(minimum) && order.indexOf(actual) <= order.indexOf(minimum);
}
export function matchResources(employees: CapabilityEmployee[], catalog: CatalogSkill[], filters: ResourceFilters, projectRequirements: SkillCriterion[] = []): ResourceMatch[] {
  const active = new Set(catalog.filter(s => s.active).map(s => s.id));
  const first = `${filters.month}-01`; const last = monthDates(filters.month).at(-1)!;
  const matches: ResourceMatch[] = [];
  for (const employee of employees) {
    if (employee.joinDate > last || (employee.exitDate && employee.exitDate < first)) continue;
    if (!`${employee.name} ${employee.code}`.toLocaleLowerCase('vi').includes(filters.query.toLocaleLowerCase('vi'))) continue;
    if ((filters.position && employee.position !== filters.position) || (filters.location && employee.location !== filters.location) || employee.level < filters.minLevel || employee.level > filters.maxLevel || !matchesJlpt(employee.jlpt, filters.jlpt)) continue;
    if (filters.availability !== 'ANY' && employee.capacity === null) continue;
    if (filters.availability === 'AVAILABLE' && (employee.available === null || employee.available <= 0)) continue;
    if (filters.minAvailableMm > 0 && (employee.available === null || employee.available < filters.minAvailableMm)) continue;
    const satisfies = (criterion: SkillCriterion) => active.has(criterion.skillId) && employee.ratings.some(r => r.active && r.skillId === criterion.skillId && r.proficiency >= criterion.minProficiency);
    const manualMatched = filters.skills.filter(satisfies).length;
    if (filters.skills.length && (filters.mode === 'ALL' ? manualMatched !== filters.skills.length : manualMatched === 0)) continue;
    const projectMatched = projectRequirements.filter(satisfies).length;
    if (projectMatched !== projectRequirements.length) continue;
    matches.push({ employee, manualMatched, manualTotal: filters.skills.length, projectMatched, projectTotal: projectRequirements.length });
  }
  return matches.sort((a,b) => (b.employee.available ?? -Infinity) - (a.employee.available ?? -Infinity) || a.employee.code.localeCompare(b.employee.code));
}
