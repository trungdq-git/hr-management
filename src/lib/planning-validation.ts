import { z } from 'zod';
import { MONTH_PATTERN, monthDates } from './planning-dates';
z.config(z.locales.vi());
const id = z.string().min(1).max(100);
const version = z.number().int().positive().nullable();
const decimal = (max: number) => z.number().finite().min(0).max(max).refine(n => Math.abs(n * 10000 - Math.round(n * 10000)) < 0.00001, 'Tối đa 4 chữ số thập phân');
export const monthSchema = z.string().regex(MONTH_PATTERN, 'Tháng YYYY-MM, năm 1900–2199');
export const calendarSchema = z.object({ name: z.string().trim().min(2).max(100) });
export const calendarMonthSchema = z.object({
  calendarId: id, month: monthSchema, standardDays: z.number().finite().positive().max(31).multipleOf(0.01), expectedVersion: version,
  days: z.array(z.object({ date: z.iso.date(), workingFraction: decimal(1), label: z.string().trim().max(120) })).min(28).max(31),
}).superRefine((v, ctx) => {
  if (!MONTH_PATTERN.test(v.month)) return;
  const dates = monthDates(v.month); const actual = new Set(v.days.map(d => d.date));
  if (v.days.length !== dates.length || actual.size !== dates.length || dates.some(d => !actual.has(d))) ctx.addIssue({ code: 'custom', message: 'Cần đủ ngày duy nhất và đúng tháng', path: ['days'] });
});
export const settingsSchema = z.object({ month: monthSchema, calendarId: id, employees: z.array(z.object({ employeeId: id, participationRate: decimal(1), expectedVersion: version })).min(1).max(500) }).refine(v => new Set(v.employees.map(e => e.employeeId)).size === v.employees.length, 'Nhân viên trùng lặp');
export const absenceSchema = z.object({ employeeId: id, date: z.iso.date().refine(d => MONTH_PATTERN.test(d.slice(0, 7)), 'Năm 1900–2199'), fraction: decimal(1), reason: z.string().trim().max(200), kind: z.enum(['LEAVE', 'UNAVAILABLE']), expectedVersion: version }).refine(v => v.fraction === 0 || v.reason.length >= 2, 'Nhập lý do nghỉ hoặc không khả dụng');
export const effortSchema = z.object({ employeeId: id, projectId: id, month: monthSchema, kind: z.enum(['PLANNED', 'ACTUAL']), mm: decimal(99999999.9999), expectedVersion: version });
