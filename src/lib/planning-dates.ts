export const MONTH_PATTERN = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;
export function currentMonth() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date());
}
export function monthStart(month: string) {
  if (!MONTH_PATTERN.test(month)) throw new Error('Tháng không hợp lệ');
  return new Date(`${month}-01T00:00:00Z`);
}
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export function monthDates(month: string) {
  const start = monthStart(month);
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => isoDate(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), i + 1))));
}
export function monthsFrom(start: string, count = 6) {
  const date = monthStart(start);
  return Array.from({ length: count }, (_, i) => isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + i, 1))).slice(0, 7));
}
export function weekdayTemplate(month: string) {
  return monthDates(month).map(date => ({ date, workingFraction: [0, 6].includes(new Date(date).getUTCDay()) ? 0 : 1, label: '' }));
}
