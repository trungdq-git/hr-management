'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
export function useForecastMutation() {
  const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState('');
  async function save(action:string,payload:unknown){setPending(true);setError('');try{const r=await fetch(`/api/forecast/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await r.json();if(!r.ok)throw new Error(body.error??'Không thể lưu');router.refresh();return true;}catch(e){setError(e instanceof Error?e.message:'Không thể kết nối hệ thống');return false;}finally{setPending(false);}}
  return {pending,error,save,reload:()=>router.refresh()};
}
export function ForecastError({mutation}:{mutation:ReturnType<typeof useForecastMutation>}){return mutation.error?<div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{mutation.error}<Button size="sm" type="button" variant="outline" className="ml-3" onClick={mutation.reload}>Tải lại dữ liệu</Button></div>:null;}
