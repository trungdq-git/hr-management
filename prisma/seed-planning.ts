import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db } from '../src/lib/db';
import { createCalendar, saveCalendarMonth, saveCapacitySettings, saveAbsence, saveEffort } from '../src/lib/planning-service';
import { weekdayTemplate } from '../src/lib/planning-dates';
const demoMonths = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];
export async function seedPlanning() {
  if (process.env.NODE_ENV === 'production') throw new Error('Không seed demo trong production');
  const actor = await db.user.findUniqueOrThrow({ where: { email: 'admin@example.test' } });
  const employees = await db.employee.findMany({ where: { id: { startsWith: 'demo-employee-' }, email: { endsWith: '@example.test' } }, orderBy: { code: 'asc' } });
  if (employees.length !== 30) throw new Error('Cần 30 hồ sơ demo từ db:seed; không áp dụng vào nhân sự thật');
  let calendar = await db.workingCalendar.findUnique({ where: { name: 'DEMO · Offshore T2–T6' } });
  if (!calendar) calendar = await createCalendar(actor.id, { name: 'DEMO · Offshore T2–T6' });
  for (const month of demoMonths) {
    const date = new Date(`${month}-01`);
    if (!await db.calendarMonth.findUnique({ where: { calendarId_month: { calendarId: calendar.id, month: date } } })) {
      const days = weekdayTemplate(month);
      const standardDays = days.reduce((s, d) => s + d.workingFraction, 0);
      if (month === '2026-10') days[19] = { date: '2026-10-20', workingFraction: 0, label: 'Ngày nghỉ doanh nghiệp giả lập' };
      await saveCalendarMonth(actor.id, { calendarId: calendar.id, month, standardDays, expectedVersion: null, days });
    }
    const existing = await db.employeeCapacitySetting.findMany({ where: { month: date } });
    const missing = employees.filter(e => !existing.some(s => s.employeeId === e.id));
    if (missing.length) await saveCapacitySettings(actor.id, { month, calendarId: calendar.id, employees: missing.map(e => ({ employeeId: e.id, participationRate: Number(e.participationRate), expectedVersion: null })) });
    for (let i = 0; i < 24; i++) {
      const e = employees[i];
      const projectId = `demo-project-${i % 3 + 1}`;
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (!project || !['ACTIVE','CONFIRMED'].includes(project.status) || project.startDate > new Date(`${month}-28`) || project.endDate < date || e.joinDate > new Date(`${month}-28`) || (e.exitDate && e.exitDate < date)) continue;
      const assignment = await db.projectAssignment.findUnique({ where: { employeeId_projectId: { employeeId: e.id, projectId } } });
      const planned = assignment ? await db.monthlyAllocation.findUnique({ where: { assignmentId_month: { assignmentId: assignment.id, month: date } } }) : null;
      const actual = assignment ? await db.monthlyActualEffort.findUnique({ where: { assignmentId_month: { assignmentId: assignment.id, month: date } } }) : null;
      const plannedMm = i === 7 ? 0.8 : i < 3 ? 0.6 : 0.75;
      if (!planned) await saveEffort(actor.id, { employeeId: e.id, projectId, month, kind: 'PLANNED', mm: plannedMm, expectedVersion: null });
      if (month === '2026-10' && !actual) await saveEffort(actor.id, { employeeId: e.id, projectId, month, kind: 'ACTUAL', mm: Math.round(plannedMm * 0.9 * 10000) / 10000, expectedVersion: null });
    }
  }
  const extraAssignment = await db.projectAssignment.findUnique({ where: { employeeId_projectId: { employeeId: 'demo-employee-8', projectId: 'demo-project-3' } } });
  const extra = extraAssignment ? await db.monthlyAllocation.findUnique({ where: { assignmentId_month: { assignmentId: extraAssignment.id, month: new Date('2026-10-01') } } }) : null;
  if (!extra) await saveEffort(actor.id, { employeeId: 'demo-employee-8', projectId: 'demo-project-3', month: '2026-10', kind: 'PLANNED', mm: 0.5, expectedVersion: null });
  const absence = await db.employeeAbsence.findUnique({ where: { employeeId_date: { employeeId: 'demo-employee-10', date: new Date('2026-10-16') } } });
  if (!absence) await saveAbsence(actor.id, { employeeId: 'demo-employee-10', date: '2026-10-16', kind: 'LEAVE', fraction: 1, reason: 'Nghỉ phép demo', expectedVersion: null });
  console.log('Seed Phase 2: lịch mẫu 10/2026–03/2027, capacity, planned/actual, đa dự án và cảnh báo. Không ghi đè dữ liệu đã có.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedPlanning().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
}
