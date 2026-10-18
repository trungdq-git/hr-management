import { availableWorkingDays, roundMm } from './mm';
import { monthDates } from './planning-dates';
export type CapacityInput = {
  month: string; joinDate: string; exitDate: string | null; participationRate: number;
  standardDays: number | null; days: { date: string; workingFraction: number }[];
  absences: { date: string; fraction: number }[];
};
export function calculateCapacity(input: CapacityInput) {
  const dates = monthDates(input.month);
  if (input.joinDate > dates.at(-1)! || (input.exitDate && input.exitDate < dates[0])) {
    return { capacity: 0, availableDays: 0, workingDays: 0, reason: 'OUTSIDE_EMPLOYMENT' as const };
  }
  if (!input.standardDays || input.standardDays <= 0) return { capacity: null, availableDays: null, workingDays: null, reason: 'MISSING_CALENDAR' as const };
  const actual = new Set(input.days.map(d => d.date));
  if (input.days.length !== dates.length || actual.size !== dates.length || dates.some(d => !actual.has(d))) {
    return { capacity: null, availableDays: null, workingDays: null, reason: 'INCOMPLETE_CALENDAR' as const };
  }
  const availableDays = availableWorkingDays(input.days, input.absences, input.joinDate, input.exitDate, input.participationRate);
  return { capacity: roundMm(availableDays / input.standardDays), availableDays, workingDays: roundMm(input.days.reduce((s, d) => s + d.workingFraction, 0)), reason: 'READY' as const };
}
export function effortSummary(capacity: number | null, planned: number[], actual: number[]) {
  const sum = (values: number[]) => values.reduce((s, n) => s + Math.round(n * 10000), 0) / 10000;
  const allocated = sum(planned);
  return { capacity, allocated, actual: sum(actual), available: capacity === null ? null : roundMm(capacity - allocated), utilization: capacity === null || capacity === 0 ? null : allocated / capacity, overallocated: capacity !== null && allocated > capacity, unallocated: capacity !== null && capacity > 0 && allocated === 0 };
}
