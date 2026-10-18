export type CalendarDayData = { date: string; workingFraction: number; label: string };
export type CalendarData = { id: string; name: string; months: { month: string; standardDays: number; version: number }[]; days: CalendarDayData[] };
export type EffortData = { projectId: string; projectName: string; projectCode: string; month: string; planned: number | null; actual: number | null; plannedVersion: number | null; actualVersion: number | null };
export type EmployeeMonthData = {
  month: string; capacity: number | null; availableDays: number | null; workingDays: number | null; standardDays: number | null;
  reason: 'OUTSIDE_EMPLOYMENT' | 'MISSING_CALENDAR' | 'INCOMPLETE_CALENDAR' | 'READY';
  allocated: number; actual: number; actualRecorded: boolean; available: number | null; utilization: number | null; overallocated: boolean; unallocated: boolean;
  calendarId: string | null; participationRate: number; settingVersion: number | null;
};
export type PlanningEmployee = {
  id: string; code: string; name: string; position: string; location: string; status: string; joinDate: string; exitDate: string | null; participationRate: number;
  months: EmployeeMonthData[]; efforts: EffortData[];
  absences: { date: string; fraction: number; reason: string; kind: 'LEAVE' | 'UNAVAILABLE'; version: number }[];
};
export type PlanningProject = { id: string; code: string; name: string; status: string; startDate: string; endDate: string };
export type PlanningData = { months: string[]; employees: PlanningEmployee[]; calendars: CalendarData[]; projects: PlanningProject[] };
export type HistoryEntry = { id: string; entity: string; action: string; actor: string; createdAt: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
