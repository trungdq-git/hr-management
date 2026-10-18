'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ImportPreview } from '@/lib/import-service';
import type { ImportKind } from '@/lib/excel';
const kinds:{value:ImportKind;label:string}[]=[{value:'employees',label:'Nhân viên'},{value:'projects',label:'Dự án'},{value:'planned',label:'Planned MM'},{value:'actual',label:'Actual MM'}];
export function ReportingWorkspace({canEdit,query}:{canEdit:boolean;query:string}){
  const router=useRouter();const [kind,setKind]=useState<ImportKind>('employees');const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState<ImportPreview|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
  const clear=()=>{setPreview(null);setSuccess('');setError('');};
  async function inspect(){
    if(!file)return;setBusy(true);clear();
    try{
      if(!file.name.toLowerCase().endsWith('.xlsx')||file.size>2*1024*1024)throw new Error('Chọn XLSX tối đa 2 MiB');
      const r=await fetch(`/api/reports/preview?kind=${kind}`,{method:'POST',headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},body:file});const data=await r.json();if(!r.ok)throw new Error(data.error);setPreview(data);
    }catch(e){setError(e instanceof Error?e.message:'Không thể xem trước');}finally{setBusy(false);}
  }
  async function commit(){
    if(!preview?.token)return;setBusy(true);setError('');
    try{const r=await fetch('/api/reports/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:preview.token})});const data=await r.json();if(!r.ok)throw new Error(data.error);setSuccess(`Đã ghi ${data.rowCount} dòng. Mã batch: ${data.id}`);setPreview(null);router.refresh();}
    catch(e){setError(e instanceof Error?e.message:'Không thể ghi');}finally{setBusy(false);}
  }
  async function download(target:string){
    setError('');setBusy(true);
    try{const r=await fetch(target);if(!r.ok){const data=await r.json();throw new Error(data.error);}const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]??'itrms.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(e){setError(e instanceof Error?e.message:'Không thể tải file');}finally{setBusy(false);}
  }
  return <section className="panel mt-6 p-6"><h2 className="font-bold">Excel import / export</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">XLSX tối đa 2 MiB, 200 dòng nhập, không công thức/macro/liên kết. Dùng mã nhân viên/dự án; mã đã có sẽ cập nhật. Xuất báo cáo theo bộ lọc phía trên, tối đa 10.000 dòng/sheet.</p>
    {error&&<p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success&&<p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">{success}</p>}
    <div className="my-5 flex flex-wrap gap-3">{[{value:'workforce',label:'Báo cáo nguồn lực'},{value:'forecast',label:'Dự báo 3 kịch bản'},...kinds].map(k=><Button key={k.value} variant="outline" disabled={busy} onClick={()=>download(`/api/reports/export?${query}&kind=${k.value}`)}>Xuất {k.label}</Button>)}</div>
    {canEdit?<><div className="flex flex-wrap items-end gap-3"><label className="text-xs">Loại dữ liệu<select aria-label="Loại import" className="input mt-2 block" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as ImportKind);clear();}}>{kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}</select></label><Button disabled={busy} variant="outline" onClick={()=>download(`/api/reports/template?kind=${kind}`)}>Tải template</Button><label className="text-xs">File XLSX<input className="mt-2 block max-w-xs" type="file" accept=".xlsx" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);clear();}}/></label><Button disabled={busy||!file} onClick={inspect}>{busy?'Đang xử lý…':'Xem trước'}</Button></div>
      {preview&&<div className="mt-6"><h3 className="font-semibold">Xem trước: {preview.rows.length} dòng hợp lệ, {preview.errors.length} lỗi</h3><p className="mt-2 text-xs text-muted-foreground">Chỉ ghi khi mọi dòng hợp lệ. Preview hết hạn sau 10 phút; thay đổi dữ liệu trong thời gian này yêu cầu xem trước lại. Không nhập trùng khóa.</p>{preview.warnings.map(w=><p key={w} className="my-3 text-xs text-amber-800">{w}</p>)}{preview.errors.map(e=><p key={e.row} className="my-2 text-xs text-red-700">Dòng {e.row}: {e.message}</p>)}<div className="my-4 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Dòng</th><th className="p-2">Thao tác</th><th className="p-2">Dữ liệu sẽ ghi</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.row} className="border-t"><td className="p-2">{r.row}</td><td className="p-2">{r.operation==='CREATE'?'Tạo mới':'Cập nhật'}</td><td className="p-2"><pre className="whitespace-pre-wrap break-all">{JSON.stringify(r.data)}</pre></td></tr>)}</tbody></table></div><Button disabled={busy||!preview.token||preview.errors.length>0} onClick={commit}>Ghi toàn bộ {preview.rows.length} dòng</Button></div>}</>:<p className="text-xs text-muted-foreground">VIEWER được xem và xuất báo cáo. ADMIN/MANAGER được nhập Excel.</p>}
  </section>;
}
