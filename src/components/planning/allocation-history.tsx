'use client';
import { useEffect, useState } from 'react';
import type { HistoryEntry } from '@/lib/planning-types';
import { Button } from '@/components/ui/button';
import { number } from '@/lib/utils';
export function AllocationHistory({ employeeId, projectId, month }: { employeeId: string; projectId?: string; month: string }) {
  const [entries,setEntries]=useState<HistoryEntry[]>([]);const [pending,setPending]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){setPending(true);setError('');try{const query=new URLSearchParams({employeeId,month,...(projectId?{projectId}:{})});const response=await fetch(`/api/planning/history?${query}`,{signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error);setEntries(body);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Không thể tải lịch sử');}finally{if(!controller.signal.aborted)setPending(false);}}
    void load();return()=>controller.abort();
  },[employeeId,projectId,month,retry]);
  if(pending)return <p role="status" className="p-5 text-xs text-muted-foreground">Đang tải lịch sử…</p>;
  if(error)return <div role="alert" className="p-5 text-xs text-red-600">{error}<Button variant="outline" size="sm" className="ml-3" onClick={()=>setRetry(n=>n+1)}>Thử lại</Button></div>;
  const value=(record:Record<string,unknown>|null)=>{if(!record)return 'Chưa nhập';const mm=record.plannedMm??record.actualMm;return mm===undefined?'—':`${number(Number(mm))} MM`;};
  return <div className="mt-4 rounded-lg border border-border"><p className="border-b border-border bg-slate-50 p-3 text-[10px] text-muted-foreground">Tối đa 100 thay đổi gần nhất trong tháng, gồm Planned và Actual.</p><div className="max-h-72 overflow-auto"><table><thead><tr><th>Thời gian / Người sửa</th><th>Dự án / Loại</th><th>Trước → Sau</th></tr></thead><tbody>{entries.map(entry=><tr key={entry.id}><td><span className="block text-[10px]">{new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(entry.createdAt))}</span><span className="mt-1 block text-[10px] text-muted-foreground">{entry.actor}</span></td><td>{String(entry.after?.projectName??'—')}<span className="mt-1 block text-[10px] text-muted-foreground">{entry.entity==='MonthlyAllocation'?'Planned':'Actual'}</span></td><td>{value(entry.before)} → <strong>{value(entry.after)}</strong></td></tr>)}</tbody></table>{!entries.length&&<p className="p-8 text-center text-xs text-muted-foreground">Chưa có thay đổi phân bổ được ghi nhận.</p>}</div></div>;
}
