import { z } from 'zod';
import { db } from './db';
import { HttpError } from './auth';
import { getPlanningData } from './planning-data';
import { getForecastData } from './forecast-data';
import { isoDate, monthDates } from './planning-dates';
import { monthSchema } from './planning-validation';
import { importColumns, workbookBuffer, type ExcelRow } from './excel';
import type { Prisma } from '@/generated/prisma/client';

export const reportFilter=z.object({month:monthSchema.refine(m=>m<='2199-07','Tháng bắt đầu tối đa 2199-07'),projectId:z.string().max(100).optional(),position:z.enum(['PM','BrSE','TL','Developer','Tester']).optional(),location:z.enum(['ONSITE','OFFSHORE']).optional()});
export type ReportFilter=z.infer<typeof reportFilter>;
export const exportKind=z.enum(['workforce','forecast','employees','projects','planned','actual']);
const sum=(values:number[])=>values.reduce((s,v)=>s+Math.round(v*10000),0)/10000;
export async function workforceReport(raw:unknown){
  const filter=reportFilter.parse(raw);const data=await getPlanningData(filter.month,6);
  const people=data.employees.filter(e=>(!filter.position||e.position===filter.position)&&(!filter.location||e.location===filter.location)&&(!filter.projectId||e.efforts.some(f=>f.projectId===filter.projectId)));
  const rows=people.flatMap(e=>e.months.map(m=>({employeeCode:e.code,name:e.name,position:e.position,location:e.location,month:m.month,capacity:m.capacity,planned:m.allocated,actual:m.actualRecorded?m.actual:null,available:m.available,utilization:m.utilization,status:m.reason,overallocated:m.overallocated?'Có':'Không'})));
  const summary=data.months.map(month=>{
    const active=people.filter(e=>e.joinDate<=monthDates(month).at(-1)!&&(!e.exitDate||e.exitDate>=`${month}-01`));
    const values=people.map(e=>e.months.find(m=>m.month===month)!);const complete=values.every(m=>m.capacity!==null);
    const capacity=complete?sum(values.map(m=>m.capacity!)):null;const planned=sum(values.map(m=>m.allocated));
    return {month,headcount:active.length,capacity,knownCapacity:sum(values.flatMap(m=>m.capacity===null?[]:[m.capacity])),planned,actual:values.some(m=>m.actualRecorded)?sum(values.map(m=>m.actual)):null,available:capacity===null?null:sum([capacity,-planned]),utilization:capacity===null||capacity===0?null:planned/capacity,missingCapacity:values.filter(m=>m.capacity===null).length,overallocated:values.filter(m=>m.overallocated).length};
  });
  return {filter,summary,rows};
}
const notes=[
  'Snapshot khi xuất; MM lưu/tính 4 số, capacity từ lịch/phép/tỷ lệ/ngày vào-nghỉ. Ô trống khác 0. Actual là tổng công đã ghi nhận, không suy từ Planned và không khẳng định mọi người đã khai đủ.',
  'Bộ lọc dự án chọn nhóm có assignment nhưng giữ tổng Planned mọi dự án để không che quá tải. Vai trò/địa điểm lọc supply; demand không tự chia theo vai trò/địa điểm.',
  'Forecast: Confirmed độc lập Pipeline; Expected = Confirmed + Weighted Pipeline; Gap = Supply − Expected, âm là thiếu. Thiếu đầu vào giữ ô trống, kèm số dữ liệu thiếu.',
  'Tuyển dụng lấy peak 6 tháng; quy đổi 1 MM/người/tháng là giả định. Skill Gap dùng hồ sơ hiện tại và mô hình tháng, cần rà soát lịch ngày trước khi chốt.',
];
export async function exportReport(kind:z.infer<typeof exportKind>,raw:unknown){
  const filter=reportFilter.parse(raw);
  const sheets:{name:string;columns:readonly string[];rows:ExcelRow[]}[]=[];
  if(kind==='workforce'){
    const result=await workforceReport(filter);
    sheets.push({name:'TongQuan',columns:['month','headcount','capacity','knownCapacity','planned','actual','available','utilization','missingCapacity','overallocated'],rows:result.summary},{name:'NhanSuThang',columns:['employeeCode','name','position','location','month','capacity','planned','actual','available','utilization','status','overallocated'],rows:result.rows});
  }else if(kind==='forecast'){
    const result=await getForecastData(filter.month,6,filter);
    const rows=result.outputs.flatMap(s=>s.months.map(m=>({scenario:s.kind,month:m.month,supply:m.supply,knownSupply:m.knownSupply,confirmed:m.confirmed,pipeline:m.pipeline,weightedPipeline:m.weightedPipeline,expectedDemand:m.expectedDemand,gap:m.gap,skillGap:m.skillGap,staffingGap:m.staffingGap,recruitmentMm:m.recruitmentMm,nominalHires:m.nominalHires,missingCapacity:m.missingCapacity.length,missingDemand:m.missingDemand.length,missingProbability:m.missingProbability.length,warnings:[...m.warnings,...m.unprofiledProjects.map(p=>`Chưa đủ hồ sơ: ${p}`)].join('; ')})));
    sheets.push({name:'Forecast',columns:['scenario','month','supply','knownSupply','confirmed','pipeline','weightedPipeline','expectedDemand','gap','skillGap','staffingGap','recruitmentMm','nominalHires','missingCapacity','missingDemand','missingProbability','warnings'],rows});
  }else if(kind==='employees'){
    const employees=await db.employee.findMany({where:{...(filter.position?{position:filter.position}:{}),...(filter.location?{location:filter.location}:{}),...(filter.projectId?{assignments:{some:{projectId:filter.projectId}}}:{})},orderBy:{code:'asc'},take:10001});
    sheets.push({name:'Data',columns:importColumns.employees,rows:employees.map(e=>({code:e.code,name:e.name,email:e.email,position:e.position,level:e.level,joinDate:isoDate(e.joinDate),exitDate:e.exitDate?isoDate(e.exitDate):null,experience:Number(e.experience),location:e.location,jlpt:e.jlpt,status:e.status,participationRate:Number(e.participationRate)}))});
  }else if(kind==='projects'){
    const projects=await db.project.findMany({where:{...(filter.projectId?{id:filter.projectId}:{}),...((filter.position||filter.location)?{assignments:{some:{employee:{...(filter.position?{position:filter.position}:{}),...(filter.location?{location:filter.location}:{})}}}}:{})},include:{pm:true},orderBy:{code:'asc'},take:10001});
    sheets.push({name:'Data',columns:importColumns.projects,rows:projects.map(p=>({code:p.code,name:p.name,customer:p.customer,pmCode:p.pm?.code??null,startDate:isoDate(p.startDate),endDate:isoDate(p.endDate),status:p.status,contractedMm:Number(p.contractedMm),forecastMm:Number(p.forecastMm)}))});
  }else{
    const data=await getPlanningData(filter.month,6);const rows=data.employees.filter(e=>(!filter.position||e.position===filter.position)&&(!filter.location||e.location===filter.location)).flatMap(e=>e.efforts.filter(f=>!filter.projectId||f.projectId===filter.projectId).flatMap(f=>{const mm=kind==='planned'?f.planned:f.actual;return mm===null?[]:[{employeeCode:e.code,projectCode:f.projectCode,month:f.month,mm}];}));
    sheets.push({name:'Data',columns:importColumns[kind],rows});
  }
  if(sheets.some(s=>s.rows.length>10000))throw new HttpError(413,'Báo cáo vượt 10.000 dòng/sheet; hãy thu hẹp bộ lọc');
  return workbookBuffer(sheets,[`Xuất lúc ${new Date().toISOString()}. Bộ lọc ${JSON.stringify(filter)}.`,...notes]);
}

export function redactAudit(value:unknown,depth=0):unknown{
  if(depth>15)return '[Đã rút gọn]';
  if(Array.isArray(value))return value.map(v=>redactAudit(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/password|secret|token|cookie|authorization/i.test(k)?'[Đã ẩn]':redactAudit(v,depth+1)]));
  return value;
}
export const auditFilter=z.object({entity:z.string().max(100).optional(),action:z.string().max(100).optional(),actorId:z.string().max(100).optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).refine(v=>!v.from||!v.to||v.from<=v.to,'Ngày bắt đầu phải trước ngày kết thúc');
export async function auditReport(raw:unknown){
  const input=auditFilter.parse(raw);
  const where:Prisma.AuditLogWhereInput={...(input.entity?{entity:input.entity}:{}),...(input.action?{action:input.action}:{}),...(input.actorId?{actorId:input.actorId}:{}),...((input.from||input.to)?{createdAt:{...(input.from?{gte:new Date(`${input.from}T00:00:00+07:00`)}:{}),...(input.to?{lt:new Date(new Date(`${input.to}T00:00:00+07:00`).getTime()+86400000)}:{})}}:{})};
  const [total,logs]=await db.$transaction([db.auditLog.count({where}),db.auditLog.findMany({where,include:{actor:{select:{name:true,email:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(input.page-1)*30,take:30})],{isolationLevel:'RepeatableRead'});
  return {total,page:input.page,pages:Math.max(1,Math.ceil(total/30)),logs:logs.map(l=>({...l,createdAt:l.createdAt.toISOString(),before:redactAudit(l.before),after:redactAudit(l.after)}))};
}
