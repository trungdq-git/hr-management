import { z } from 'zod';
z.config(z.locales.vi());
const dateOnly = z.iso.date();
export const employeeSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9-]+$/), name: z.string().trim().min(2).max(120), email: z.email().max(200).transform(s => s.toLowerCase()),
  position: z.enum(['PM','BrSE','TL','Developer','Tester']), level: z.coerce.number().int().min(1).max(6), joinDate: dateOnly, exitDate: dateOnly.nullable(), experience: z.coerce.number().min(0).max(60),
  location: z.enum(['OFFSHORE','ONSITE']), jlpt: z.enum(['N1','N2','N3','N4','N5','NONE']), status: z.enum(['ACTIVE','PROBATION','ON_LEAVE','RESIGNED']), participationRate: z.coerce.number().min(0).max(1)
}).refine(v => !v.exitDate || v.exitDate >= v.joinDate, { message: 'Ngày nghỉ phải sau ngày vào làm', path: ['exitDate'] }).refine(v => v.status !== 'RESIGNED' || !!v.exitDate, { message: 'Cần ngày nghỉ việc', path: ['exitDate'] });
export const projectSchema = z.object({ code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9-]+$/), name: z.string().trim().min(2).max(150), customer: z.string().trim().min(2).max(150), pmId: z.string().nullable(), startDate: dateOnly, endDate: dateOnly, status: z.enum(['PIPELINE','CONFIRMED','ACTIVE','COMPLETED','CANCELLED']), contractedMm: z.coerce.number().min(0).max(99999999), forecastMm: z.coerce.number().min(0).max(99999999) }).refine(v => v.endDate >= v.startDate, { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['endDate'] });
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
