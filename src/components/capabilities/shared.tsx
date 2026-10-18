'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
export function useCapabilityMutation() {
  const router = useRouter(); const [pending,setPending]=useState(false); const [error,setError]=useState('');
  async function save(action:string,payload:unknown) {
    setPending(true);setError('');
    try { const response=await fetch(`/api/capabilities/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const body=await response.json();if(!response.ok)throw new Error(body.error??'Không thể lưu dữ liệu');router.refresh();return true; }
    catch(e){setError(e instanceof Error?e.message:'Không thể kết nối hệ thống');return false;}
    finally{setPending(false);}
  }
  return {pending,error,save,reload:()=>router.refresh()};
}
export function CapabilityError({mutation}:{mutation:ReturnType<typeof useCapabilityMutation>}) {
  return mutation.error?<div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{mutation.error}<Button type="button" variant="outline" size="sm" className="ml-3" onClick={mutation.reload}>Tải lại dữ liệu</Button></div>:null;
}
export const proficiencyLabels=['','1 · Cơ bản','2 · Có hỗ trợ','3 · Độc lập','4 · Nâng cao','5 · Chuyên sâu'];
