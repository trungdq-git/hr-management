import { describe, expect, it } from 'vitest';
import { calculateCapacity, effortSummary, type CapacityInput } from '../src/lib/capacity';
import { monthDates, monthsFrom, weekdayTemplate } from '../src/lib/planning-dates';
import { calendarMonthSchema, effortSchema } from '../src/lib/planning-validation';
const base: CapacityInput = { month: '2026-10', joinDate: '2020-01-01', exitDate: null, participationRate: 1, standardDays: 22, days: weekdayTemplate('2026-10'), absences: [] };
describe('Phase 2 capacity engine', () => {
  it('calculates all weekdays, a holiday, half-day leave and effective participation', () => {
    const days = base.days.map(d => d.date === '2026-10-20' ? { ...d, workingFraction: 0 } : d);
    expect(calculateCapacity({ ...base, days, participationRate: 0.8, absences: [{ date: '2026-10-16', fraction: 0.5 }, { date: '2026-10-17', fraction: 1 }] })).toMatchObject({ workingDays: 21, availableDays: 16.4, capacity: 0.7455, reason: 'READY' });
  });
  it('clips days to joining and leaving dates within a month', () => {
    expect(calculateCapacity({ ...base, joinDate: '2026-10-15', exitDate: '2026-10-16' }).capacity).toBe(0.0909);
  });
  it.each([{ joinDate: '2026-11-01', exitDate: null }, { joinDate: '2020-01-01', exitDate: '2026-09-30' }])('outside employment requires no calendar: %j', dates => {
    expect(calculateCapacity({ ...base, ...dates, standardDays: null, days: [] })).toMatchObject({ capacity: 0, reason: 'OUTSIDE_EMPLOYMENT' });
  });
  it('distinguishes missing and incomplete data from zero capacity', () => {
    expect(calculateCapacity({ ...base, standardDays: null }).capacity).toBeNull();
    expect(calculateCapacity({ ...base, days: base.days.slice(1) }).reason).toBe('INCOMPLETE_CALENDAR');
    expect(calculateCapacity({ ...base, participationRate: 0 }).capacity).toBe(0);
    expect(calculateCapacity({ ...base, days: base.days.map(d => ({ ...d, workingFraction: 0 })) }).capacity).toBe(0);
  });
  it('rejects duplicate dates as incomplete instead of publishing false capacity', () => {
    expect(calculateCapacity({ ...base, days: base.days.map((d, i) => i === 1 ? base.days[0] : d) }).capacity).toBeNull();
  });
  it('retains 8-place day accuracy until the MM division', () => {
    const days = base.days.map((d, i) => ({ ...d, workingFraction: i === 0 ? 0.3333 : 0 }));
    expect(calculateCapacity({ ...base, days, participationRate: 0.3333, standardDays: 20 })).toMatchObject({ availableDays: 0.11108889, capacity: 0.0056 });
  });
  it('keeps planned and actual independent and preserves negative available', () => {
    expect(effortSummary(0.8, [0.6, 0.5], [0.2])).toMatchObject({ allocated: 1.1, actual: 0.2, available: -0.3, overallocated: true, unallocated: false });
    expect(effortSummary(0, [0.1], []).utilization).toBeNull();
    expect(effortSummary(null, [0.1], [])).toMatchObject({ available: null, overallocated: false, unallocated: false });
    expect(effortSummary(1, [], []).unallocated).toBe(true);
  });
  it('supports leap years and six months spanning years', () => {
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2027-02')).toHaveLength(28);
    expect(monthsFrom('2026-10')).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
  });
  it('validates exact full-month calendars, date ranges and decimal precision', () => {
    const valid = { calendarId: 'test', month: '2026-10', standardDays: 22, expectedVersion: null, days: weekdayTemplate('2026-10') };
    expect(calendarMonthSchema.safeParse(valid).success).toBe(true);
    expect(calendarMonthSchema.safeParse({ ...valid, month: 'invalid' }).success).toBe(false);
    expect(calendarMonthSchema.safeParse({ ...valid, days: valid.days.slice(1) }).success).toBe(false);
    expect(effortSchema.safeParse({ employeeId: 'e', projectId: 'p', month: '2026-10', kind: 'PLANNED', mm: 0.12345, expectedVersion: null }).success).toBe(false);
  });
});
