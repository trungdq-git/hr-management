'use client';
import { useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CalendarData } from '@/lib/planning-types';
import { monthDates, weekdayTemplate } from '@/lib/planning-dates';
import { number } from '@/lib/utils';
import { SaveButton, SaveStatus, usePlanningMutation } from './shared';

export function CalendarPanel({ calendars, month, canEdit }: { calendars: CalendarData[]; month: string; canEdit: boolean }) {
  const [selected, setSelected] = useState(calendars[0]?.id ?? '');
  const mutation = usePlanningMutation();
  const calendar = calendars.find(c => c.id === selected) ?? calendars[0];
  return <div className="grid items-start gap-6 xl:grid-cols-[260px_1fr]">
    <aside className="panel p-5"><h2 className="mb-4 font-bold">Lịch làm việc</h2><div className="space-y-2">{calendars.map(c => <button key={c.id} onClick={() => setSelected(c.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-3 text-left text-xs ${calendar?.id === c.id ? 'border-blue-200 bg-blue-50 text-primary' : 'border-border'}`}><CalendarDays size={15} />{c.name}</button>)}</div>
      {!calendars.length && <p className="text-xs text-muted-foreground">Chưa có lịch làm việc. Tạo lịch để bắt đầu.</p>}
      {canEdit && <form className="mt-6 border-t border-border pt-5" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const name = String(new FormData(form).get('name')); if (await mutation.save('calendars', { name })) form.reset(); }}><label className="field">Tên lịch mới<input name="name" required minLength={2} maxLength={100} placeholder="Ví dụ: Offshore Hà Nội" /></label><Button disabled={mutation.pending} type="submit" variant="outline" className="mt-3 w-full"><Plus size={14} />Tạo lịch</Button><SaveStatus mutation={mutation} /></form>}
      <p className="mt-6 text-[11px] leading-6 text-muted-foreground">Lịch mẫu không tự áp dụng ngày lễ. Hãy đánh dấu ngày lễ, nghỉ bù và ngày làm việc đặc biệt theo lịch doanh nghiệp.</p>
    </aside>
    {calendar ? <CalendarEditor key={`${calendar.id}:${month}:${calendar.months.find(m => m.month === month)?.version ?? 0}`} calendar={calendar} month={month} canEdit={canEdit} /> : <section className="panel p-12 text-center text-muted-foreground">Tạo lịch, thiết lập tháng, sau đó gán lịch cho nhân viên.</section>}
  </div>;
}
function CalendarEditor({ calendar, month, canEdit }: { calendar: CalendarData; month: string; canEdit: boolean }) {
  const config = calendar.months.find(m => m.month === month);
  const [days, setDays] = useState(() => monthDates(month).map(date => calendar.days.find(d => d.date === date) ?? { date, workingFraction: 0, label: '' }));
  const mutation = usePlanningMutation();
  return <section className="panel overflow-hidden"><form onSubmit={async e => { e.preventDefault(); await mutation.save('calendar-month', { calendarId: calendar.id, month, standardDays: Number(new FormData(e.currentTarget).get('standardDays')), expectedVersion: config?.version ?? null, days }); }}>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-5"><div><h2 className="font-bold">{calendar.name} · {month.split('-').reverse().join('/')}</h2><p className="mt-2 text-xs text-muted-foreground">{config ? `Phiên bản ${config.version}` : 'Chưa thiết lập tháng'} · {number(days.reduce((s, d) => s + d.workingFraction, 0))} ngày công theo lịch</p></div><label className="field">Ngày công chuẩn (mẫu số MM)<input name="standardDays" type="number" required min="0.01" max="31" step="0.01" disabled={!canEdit} defaultValue={config?.standardDays ?? weekdayTemplate(month).reduce((s, d) => s + d.workingFraction, 0)} className="w-48" /></label></div>
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-3"><p className="text-[11px] text-muted-foreground">1 = cả ngày · 0,5 = nửa ngày · 0 = ngày nghỉ</p>{canEdit && <Button type="button" variant="outline" size="sm" onClick={() => setDays(weekdayTemplate(month))}>Điền mẫu T2–T6 (thay nội dung đang sửa)</Button>}</div>
    <fieldset disabled={!canEdit || mutation.pending} className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{days.map((d, i) => {
      const weekend = [0, 6].includes(new Date(d.date).getUTCDay());
      return <div key={d.date} className={`rounded-lg border p-3 ${d.workingFraction === 0 ? 'border-orange-100 bg-orange-50/40' : 'border-border'}`}><span className={`mb-2 block text-xs font-semibold ${weekend ? 'text-orange-600' : ''}`}>{d.date.slice(-2)} · {new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(d.date))}</span><label className="field"><span className="sr-only">Công ngày {d.date}</span><input type="number" aria-label={`Công ngày ${d.date}`} value={d.workingFraction} min="0" max="1" step="0.0001" required onChange={e => setDays(old => old.map((v, n) => n === i ? { ...v, workingFraction: Number(e.target.value) } : v))} /></label><input aria-label={`Ghi chú ${d.date}`} placeholder="Ngày lễ / nghỉ bù…" maxLength={120} value={d.label} onChange={e => setDays(old => old.map((v, n) => n === i ? { ...v, label: e.target.value } : v))} className="mt-2 w-full !text-[10px]" /></div>;
    })}</fieldset><div className="border-t border-border p-5"><p className="mb-4 text-[11px] leading-5 text-muted-foreground">Sửa lịch áp dụng cho tất cả nhân viên được gán lịch này trong tháng. Lịch các tháng khác được giữ nguyên; lịch sử được lưu khi thay đổi.</p>{canEdit && <SaveButton pending={mutation.pending}>Lưu toàn bộ lịch tháng</SaveButton>}<SaveStatus mutation={mutation} /></div>
  </form></section>;
}
