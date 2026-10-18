/** Integer decimal arithmetic: inputs are persisted at 4 decimal places. */
export const roundMm = (n: number) => Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 10000) / 10000;
export function mmSummary(availableDays: number, standardDays: number, allocations: number[]) {
  if (![availableDays, standardDays, ...allocations].every(Number.isFinite) || availableDays < 0 || standardDays <= 0 || allocations.some(n => n < 0)) throw new Error('Dữ liệu MM không hợp lệ');
  const capacity = roundMm(availableDays / standardDays);
  const allocated = allocations.reduce((sum, n) => sum + Math.round(n * 10000), 0) / 10000;
  return { capacity, allocated, available: roundMm(capacity - allocated), utilization: capacity === 0 ? null : allocated / capacity, overallocated: allocated > capacity };
}
export function availableWorkingDays(days: { date: string; workingFraction: number }[], absences: { date: string; fraction: number }[], joinDate: string, exitDate: string | null, participationRate: number) {
  if (participationRate < 0 || participationRate > 1 || !Number.isFinite(participationRate)) throw new Error('Tỷ lệ không hợp lệ');
  const absent = new Map<string, number>();
  for (const a of absences) {
    if (!Number.isFinite(a.fraction) || a.fraction < 0 || a.fraction > 1) throw new Error('Ngày nghỉ không hợp lệ');
    absent.set(a.date, (absent.get(a.date) ?? 0) + a.fraction);
  }
  const seen = new Set<string>();
  let total = 0;
  for (const d of days) {
    if (seen.has(d.date) || !Number.isFinite(d.workingFraction) || d.workingFraction < 0 || d.workingFraction > 1) throw new Error('Lịch không hợp lệ');
    seen.add(d.date);
    if (d.date >= joinDate && (!exitDate || d.date <= exitDate)) total += Math.max(0, d.workingFraction - (absent.get(d.date) ?? 0));
  }
  // Day fractions and participation are 4-place inputs: retain 8 places until the final MM division.
  return Math.round(total * participationRate * 100000000) / 100000000;
}
