import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Layers, ArrowLeft } from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { roles } from '@/lib/labels';
const modules:Record<string,{title:string;phase:number;items:string[]}>= {
  reports:{title:'Báo cáo & phân tích',phase:5,items:['Excel Import có preview và kiểm tra dữ liệu','Excel Export và báo cáo tổng hợp','Tra cứu Audit Log và chuẩn bị production']},
};
export default async function ModulePage({params}:{params:Promise<{module:string}>}) {
  const {module}=await params;const user=await requireUser();
  if(module==='settings')return <><PageHeading eyebrow="SYSTEM SETTINGS" title="Cài đặt hệ thống" description="Thông tin phiên làm việc và cấu hình nền tảng."/><section className="panel max-w-2xl p-7"><h2 className="mb-6 font-semibold">Phiên hiện tại</h2><dl className="space-y-5 text-sm">{[['Tài khoản',user.email],['Quyền truy cập',roles[user.role]],['Phiên bản','0.5.0 · Reporting'],['Múi giờ nghiệp vụ','Asia/Ho_Chi_Minh'],['Độ chính xác MM','Lưu 4 số · Hiển thị 2 số'],['Quản trị người dùng','Qua quy trình vận hành · chưa có UI']].map(([k,v])=><div key={k} className="flex flex-wrap justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl></section></>;
  const config=modules[module];if(!config)notFound();
  return <><PageHeading eyebrow={`ROADMAP · PHASE ${config.phase}`} title={config.title} description="Module đã có mô hình dữ liệu, giao diện nghiệp vụ sẽ được triển khai theo lộ trình."/><section className="panel mx-auto my-10 max-w-2xl p-10"><span className="mb-6 inline-flex rounded-2xl bg-orange-50 p-4 text-orange-500"><Layers size={30}/></span><span className="eyebrow block">DỰ KIẾN PHASE {config.phase}</span><h2 className="mt-3 text-2xl font-bold">Nền tảng hôm nay, mở rộng ngày mai.</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">Phase 4 đã có demand tháng, forecast và phân tích kịch bản. Module này chưa được triển khai.</p><ul className="my-7 space-y-4">{config.items.map((item,i)=><li className="flex items-center gap-3 text-xs" key={item}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500">0{i+1}</span>{item}</li>)}</ul><Button asChild variant="outline"><Link href="/"><ArrowLeft size={14}/>Về tổng quan</Link></Button></section></>;
}
