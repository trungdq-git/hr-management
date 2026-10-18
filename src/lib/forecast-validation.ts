import { z } from 'zod';
import { monthSchema } from './planning-validation';
z.config(z.locales.vi());
const id = z.string().min(1).max(100);
const version = z.number().int().positive().nullable();
const mm = z.number().finite().min(0).max(99999999.9999).refine(v => Math.abs(v * 10000 - Math.round(v * 10000)) < 0.00001, 'Tối đa 4 chữ số thập phân');
export const demandSchema = z.object({ projectId: id, month: monthSchema, demandMm: mm, expectedVersion: version, skills: z.array(z.object({ skillId: id, requiredMm: mm.refine(v => v > 0, 'MM kỹ năng phải lớn hơn 0'), minProficiency: z.number().int().min(1).max(5) })).max(30) }).refine(v => new Set(v.skills.map(s => s.skillId)).size === v.skills.length, 'Kỹ năng chính không được trùng').refine(v => v.skills.reduce((sum, s) => sum + Math.round(s.requiredMm * 10000), 0) <= Math.round(v.demandMm * 10000), 'Tổng MM kỹ năng không được vượt demand dự án');
export const probabilitySchema = z.object({ projectId: id, scenarioId: id, probability: z.number().finite().min(0).max(1).refine(v => Math.abs(v * 10000 - Math.round(v * 10000)) < 0.00001, 'Tối đa 4 chữ số thập phân').nullable(), expectedVersion: version });
