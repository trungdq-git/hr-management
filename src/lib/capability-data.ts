import { db } from './db';
import { getPlanningData } from './planning-data';
import { isoDate, monthDates } from './planning-dates';
import { resourceFilterSchema } from './capability-validation';
import { matchResources } from './capability-matching';
import { HttpError } from './auth';
import type { CapabilityData, ResourceSearchResult } from './capability-types';

export async function getCapabilityData(month: string): Promise<CapabilityData> {
  const [planning, employees, skills, projects] = await Promise.all([
    getPlanningData(month, 1),
    db.employee.findMany({ select: { id: true, level: true, jlpt: true, skills: true } }),
    db.skill.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    db.project.findMany({ include: { requirements: true }, orderBy: { code: 'asc' } }),
  ]);
  const profiles = new Map(employees.map(e => [e.id, e]));
  return {
    month, skills,
    employees: planning.employees.filter(e => profiles.has(e.id)).map(e => {
      const profile = profiles.get(e.id)!;
      return { id: e.id, code: e.code, name: e.name, position: e.position, location: e.location, status: e.status, joinDate: e.joinDate, exitDate: e.exitDate, level: profile.level, jlpt: profile.jlpt, capacity: e.months[0].capacity, allocated: e.months[0].allocated, available: e.months[0].available, ratings: profile.skills.map(r => ({ skillId: r.skillId, proficiency: r.proficiency, active: r.active, version: r.version })) };
    }),
    projects: projects.map(p => ({ id: p.id, code: p.code, name: p.name, customer: p.customer, status: p.status, startDate: isoDate(p.startDate), endDate: isoDate(p.endDate), requirements: p.requirements.map(r => ({ skillId: r.skillId, minProficiency: r.minProficiency, requiredMm: Number(r.requiredMm), active: r.active, version: r.version })) })),
  };
}
export async function searchResources(raw: unknown): Promise<ResourceSearchResult> {
  const filters = resourceFilterSchema.parse(raw);
  const data = await getCapabilityData(filters.month);
  const active = new Set(data.skills.filter(s => s.active).map(s => s.id));
  if (filters.skills.some(s => !active.has(s.skillId))) throw new HttpError(400, 'Bộ lọc có kỹ năng không tồn tại hoặc đã lưu trữ. Tải lại danh mục.');
  const project = filters.projectId ? data.projects.find(p => p.id === filters.projectId) : null;
  if (filters.projectId && !project) throw new HttpError(404, 'Không tìm thấy dự án');
  if (project && (project.startDate > monthDates(filters.month).at(-1)! || project.endDate < `${filters.month}-01`)) throw new HttpError(400, 'Chọn tháng trong thời gian dự án');
  const requirements = project?.requirements.filter(r => r.active).map(r => ({ skillId: r.skillId, minProficiency: r.minProficiency })) ?? [];
  if (requirements.some(r => !active.has(r.skillId))) throw new HttpError(400, 'Yêu cầu dự án đang tham chiếu kỹ năng đã lưu trữ. Cần cập nhật yêu cầu trước khi tìm.');
  return { month: filters.month, matches: matchResources(data.employees, data.skills, filters, requirements), project: project ?? null, projectRequirements: requirements, missingProjectRequirements: !!project && !requirements.length };
}
