'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { number } from '@/lib/utils';

export function usePlanningMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save(action: string, payload: unknown) {
    setPending(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/planning/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Không thể lưu dữ liệu');
      setMessage('Đã lưu thay đổi.'); router.refresh(); return true;
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể kết nối hệ thống'); return false; }
    finally { setPending(false); }
  }
  return { pending, error, message, save };
}
export function SaveStatus({ mutation }: { mutation: ReturnType<typeof usePlanningMutation> }) {
  return <>{mutation.error && <p role="alert" className="mt-3 text-xs text-red-600">{mutation.error}</p>}{mutation.message && <p role="status" className="mt-3 text-xs text-emerald-700">{mutation.message}</p>}</>;
}
export function SaveButton({ pending, children = 'Lưu thay đổi' }: { pending: boolean; children?: React.ReactNode }) {
  return <Button type="submit" disabled={pending}>{pending && <LoaderCircle size={14} className="animate-spin" />}{children}</Button>;
}
export function Mm({ value, suffix = ' MM' }: { value: number | null; suffix?: string }) { return <>{value === null ? '—' : `${number(value)}${suffix}`}</>; }
export const capacityReasons = { READY: 'Đã thiết lập', MISSING_CALENDAR: 'Chưa có lịch/ngày chuẩn', INCOMPLETE_CALENDAR: 'Lịch chưa đủ ngày', OUTSIDE_EMPLOYMENT: 'Ngoài thời gian làm việc' };
