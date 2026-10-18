import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { currentMonth } from '@/lib/planning-dates';
import { reportFilter, workforceReport } from '@/lib/reporting';
import { db } from '@/lib/db';
import { number } from '@/lib/utils';
import { PageHeading } from '@/components/page-heading';
import { ReportingWorkspace } from '@/components/reporting-workspace';
export default async function ReportsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();const q=await searchParams;
  const parsed=reportFilter.safeParse({month:q.month??currentMonth(),projectId:q.projectId||undefined,position:q.position||undefined,location:q.location||undefined});
  if(!parsed.success)return <section role="alert" className="panel p-6">Bộ lọc không hợp lệ: {parsed.error.issues.map(i=>i.message).join('; ')}. <Link href="/reports" className="underline">Đặt lại bộ lọc</Link></section>;
  const data=await workforceReport(parsed.data);const projects=await db.project.findMany({select:{id:true,code:true,name:true},orderBy:{code:'asc'}});
  const query=new URLSearchParams(Object.fromEntries(Object.entries(parsed.data).filter(([,v])=>v!==undefined)) as Record<string,string>).toString();
  const display=(n:number|null)=>n===null?'—':number(n);
  return <><PageHeading eyebrow="REPORTING" title="Báo cáo nguồn lực" description="Capacity, Planned và Actual theo tháng; xuất Excel và nhập dữ liệu có xem trước."/>
    <form className="panel mb-6 flex flex-wrap items-end gap-4 p-5"><label className="text-xs">Bắt đầu<input aria-label="Tháng báo cáo" className="input mt-2 block" type="month" min="1900-01" max="2199-07" name="month" defaultValue={data.filter.month}/></label><label className="text-xs">Dự án<select className="input mt-2 block max-w-60" name="projectId" defaultValue={q.projectId??''}><option value="">Tất cả</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label><label className="text-xs">Vai trò<select className="input mt-2 block" name="position" defaultValue={q.position??''}><option value="">Tất cả</option>{['PM','BrSE','TL','Developer','Tester'].map(p=><option key={p}>{p}</option>)}</select></label><label className="text-xs">Địa điểm<select className="input mt-2 block" name="location" defaultValue={q.location??''}><option value="">Tất cả</option><option>ONSITE</option><option>OFFSHORE</option></select></label><button className="rounded-lg bg-primary px-5 py-2.5 text-xs text-white">Áp dụng</button>{user.role!=='VIEWER'&&<Link href="/audit" className="p-2 text-xs text-primary underline">Tra cứu Audit Log</Link>}</form>
    <section className="panel overflow-x-auto p-5"><h2 className="mb-3 font-semibold">Tổng hợp 6 tháng</h2><p className="mb-4 text-xs leading-6 text-muted-foreground">Ô — là chưa xác định/chưa nhập. Actual là tổng đã ghi nhận, có thể chưa đủ khai báo. Lọc dự án chọn nhóm có assignment nhưng giữ tổng Planned mọi dự án để thấy quá tải. Không cộng capacity/headcount các tháng thành số nhân viên.</p><table className="w-full text-right text-xs"><thead><tr>{['Tháng','Headcount','Capacity MM','Planned MM','Actual MM','Available MM','Utilization','Thiếu lịch','Quá tải'].map(h=><th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>{data.summary.map(m=><tr key={m.month} className="border-t"><td className="p-3">{m.month}</td><td>{m.headcount}</td><td>{display(m.capacity)}</td><td>{display(m.planned)}</td><td>{display(m.actual)}</td><td className={m.available!==null&&m.available<0?'text-red-700':''}>{display(m.available)}</td><td>{m.utilization===null?'—':`${number(m.utilization*100)}%`}</td><td>{m.missingCapacity}</td><td>{m.overallocated}</td></tr>)}</tbody></table>{!data.rows.length&&<p className="p-6 text-center text-sm text-muted-foreground">Không có nhân viên phù hợp bộ lọc.</p>}</section>
    <ReportingWorkspace canEdit={user.role!=='VIEWER'} query={query}/></>;
}
