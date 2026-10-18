import Link from 'next/link';
import { getForecastData, type ForecastScope } from '@/lib/forecast-data';
import { number } from '@/lib/utils';
import { ForecastCharts } from './charts';
import { WorkforceCharts } from './workforce-charts';
export async function ForecastDashboardWidget({month,scope}:{month:string;scope:ForecastScope}){
  if(month>'2199-07')return null;
  const data=await getForecastData(month,6,scope);const selected=data.outputs.find(o=>o.kind==='BASE')??data.outputs[0];
  if(!selected)return <section className="panel mb-6 p-5"><h2 className="font-bold">Dự báo 6 tháng</h2><Link href={`/forecast?month=${month}`} className="mt-3 inline-block text-xs text-primary underline">Thiết lập kịch bản và demand</Link></section>;
  const row=selected.months[0];const display=(n:number|null)=>n===null?'Chưa xác định':`${number(n)} MM`;
  return <section className="mb-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Dự báo 6 tháng · Base</h2><p className="mt-2 text-[10px] leading-5 text-muted-foreground">Supply theo nhóm nhân viên đã lọc; khi chọn dự án, dùng nhóm có assignment vào dự án đó. Demand vẫn là tổng nhu cầu của các dự án trong phạm vi, không tự chia theo vai trò/địa điểm.</p></div><Link href={`/forecast?month=${month}`} className="text-xs font-semibold text-primary underline">Mở phân tích toàn bộ bộ phận</Link></div><div className="mb-5 grid gap-4 sm:grid-cols-3">{[['Forecast Demand',row.expectedDemand],['Resource Gap',row.gap],['Skill Gap bổ sung',row.skillGap]].map(([label,value])=><div className="panel p-5" key={String(label)}><p className="text-[11px] text-muted-foreground">{label} · {month}</p><p className="mt-3 text-xl font-bold">{display(value as number|null)}</p></div>)}</div><ForecastCharts selected={selected} outputs={data.outputs}/><WorkforceCharts selected={selected} distribution={data.distribution}/></section>;
}
