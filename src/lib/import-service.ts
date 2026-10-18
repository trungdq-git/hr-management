import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { db } from './db';
import { HttpError } from './auth';
import { employeeSchema, projectSchema } from './validation';
import { effortSchema } from './planning-validation';
import { saveEffortInTransaction } from './planning-service';
import { monthDates, monthStart } from './planning-dates';
import { importColumns, type ExcelRow, type ImportKind } from './excel';
import type { Prisma } from '@/generated/prisma/client';

const json=(v:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(v));
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const key=()=>{
  const value=process.env.SESSION_SECRET;
  if(!value || value.length<32 || value.startsWith('replace-'))throw new Error('SESSION_SECRET chưa hợp lệ');
  return new TextEncoder().encode(value);
};
const kindSchema=z.enum(['employees','projects','planned','actual']);
type Tx=Prisma.TransactionClient;
type Prepared={row:number;data:ExcelRow;fingerprint:string;operation:'CREATE'|'UPDATE'};
export type ImportPreview={kind:ImportKind;rows:Prepared[];errors:{row:number;message:string}[];warnings:string[];token:string|null};

function required(row:ExcelRow,columns:readonly string[],optional:string[]){
  for(const column of columns)if(!optional.includes(column) && (row[column]===null || row[column]===undefined || row[column]===''))throw new HttpError(400,`Thiếu ${column}`);
}
function precision(value:number,places:number,label:string){
  const factor=10**places;
  if(Math.abs(value*factor-Math.round(value*factor))>0.00001)throw new HttpError(400,`${label}: tối đa ${places} chữ số thập phân`);
}
export async function prepareImport(tx:Tx,kind:ImportKind,rows:ExcelRow[]):Promise<Omit<ImportPreview,'token'>>{
  const prepared:Prepared[]=[];const errors:{row:number;message:string}[]=[];const seen=new Set<string>();const emails=new Set<string>();
  for(const [index,raw] of rows.entries()){
    try{
      const row={...raw};required(row,importColumns[kind],kind==='employees'?['exitDate']:kind==='projects'?['pmCode']:[]);
      const natural=kind==='employees'||kind==='projects'?String(row.code):`${row.employeeCode}:${row.projectCode}:${row.month}`;
      if(seen.has(natural))throw new HttpError(400,'Trùng khóa trong file');seen.add(natural);
      let before:unknown=null,dependencies:unknown=null;
      if(kind==='employees'){
        const data=employeeSchema.parse({...row,exitDate:row.exitDate||null});
        precision(data.participationRate,4,'participationRate');precision(data.experience,2,'experience');
        if(emails.has(data.email))throw new HttpError(400,'Email trùng trong file');emails.add(data.email);
        Object.assign(row,data);
        before=await tx.employee.findUnique({where:{code:data.code}});
        const other=await tx.employee.findUnique({where:{email:data.email}});
        if(other && other.code!==data.code)throw new HttpError(400,'Email thuộc nhân viên khác');
      }else if(kind==='projects'){
        const pm=row.pmCode?await tx.employee.findUnique({where:{code:String(row.pmCode)}}):null;
        if(row.pmCode && (!pm || pm.position!=='PM' || pm.status==='RESIGNED'))throw new HttpError(400,'pmCode phải là PM còn làm việc');
        const data=projectSchema.parse({...row,pmId:pm?.id??null});
        precision(data.contractedMm,4,'contractedMm');precision(data.forecastMm,4,'forecastMm');
        before=await tx.project.findUnique({where:{code:String(row.code)}});dependencies=pm;
      }else{
        const employee=await tx.employee.findUnique({where:{code:String(row.employeeCode)}});
        const project=await tx.project.findUnique({where:{code:String(row.projectCode)}});
        if(!employee || !project)throw new HttpError(400,'Không tìm thấy mã nhân viên/dự án');
        // Unlike z.coerce, blank MM must never silently become zero.
        if(typeof row.mm!=='number')throw new HttpError(400,'MM phải là ô số');
        const input=effortSchema.parse({employeeId:employee.id,projectId:project.id,month:row.month,kind:kind==='planned'?'PLANNED':'ACTUAL',mm:row.mm,expectedVersion:null});
        const first=monthStart(input.month),last=new Date(monthDates(input.month).at(-1)!);
        if(input.mm>0){
          if(Math.max(employee.joinDate.getTime(),project.startDate.getTime(),first.getTime())>Math.min(employee.exitDate?.getTime()??Infinity,project.endDate.getTime(),last.getTime()))throw new HttpError(400,'Không có thời gian giao nhau giữa nhân viên, dự án và tháng');
          if(project.status==='PIPELINE'||(kind==='planned'&&project.status==='CANCELLED'))throw new HttpError(400,'Không ghi MM dương cho Pipeline/Planned dự án hủy');
        }
        const assignment=await tx.projectAssignment.findUnique({where:{employeeId_projectId:{employeeId:employee.id,projectId:project.id}}});
        const where={assignmentId_month:{assignmentId:assignment?.id??'missing',month:first}};
        before=kind==='planned'?await tx.monthlyAllocation.findUnique({where}):await tx.monthlyActualEffort.findUnique({where});
        dependencies={employee,project};
      }
      prepared.push({row:index+2,data:row,fingerprint:digest({before,dependencies}),operation:before?'UPDATE':'CREATE'});
    }catch(error){errors.push({row:index+2,message:error instanceof z.ZodError?error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):error instanceof HttpError?error.message:'Không thể kiểm tra dòng dữ liệu'});}
  }
  return {kind,rows:prepared,errors,warnings:kind==='planned'?['Cho phép tổng Planned vượt capacity. Sau import, xem cảnh báo từng người/tháng ở Allocation Matrix; import không thay đổi capacity.']:[]};
}
export async function previewImport(actorId:string,kind:ImportKind,rows:ExcelRow[]):Promise<ImportPreview>{
  if(!rows.length||rows.length>200)throw new HttpError(400,'Cần 1–200 dòng');
  const result=await db.$transaction(tx=>prepareImport(tx,kind,rows),{isolationLevel:'RepeatableRead',timeout:30000});
  const token=result.errors.length?null:await new SignJWT({kind,rows:result.rows}).setProtectedHeader({alg:'HS256'}).setIssuer('dx-import').setAudience('dx-import').setSubject(actorId).setJti(randomUUID()).setIssuedAt().setExpirationTime('10m').sign(key());
  return {...result,token};
}
const payloadSchema=z.object({sub:z.string(),jti:z.string().uuid(),kind:kindSchema,rows:z.array(z.object({row:z.number().int(),data:z.record(z.string(),z.union([z.string(),z.number(),z.null()])),fingerprint:z.string(),operation:z.enum(['CREATE','UPDATE'])})).min(1).max(200)});
export async function commitImport(actorId:string,token:string){
  let input:z.infer<typeof payloadSchema>;
  try{const {payload}=await jwtVerify(token,key(),{algorithms:['HS256'],issuer:'dx-import',audience:'dx-import'});input=payloadSchema.parse(payload);}catch{throw new HttpError(400,'Preview không hợp lệ hoặc đã hết hạn; vui lòng xem trước lại');}
  if(input.sub!==actorId)throw new HttpError(403,'Preview thuộc tài khoản khác');
  return db.$transaction(async tx=>{
    // Same-token retries serialize and return the already committed batch.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.jti}))`;
    const existing=await tx.importBatch.findUnique({where:{id:input.jti}});if(existing)return {...existing,replayed:true};
    const current=await prepareImport(tx,input.kind,input.rows.map(r=>r.data));
    if(current.errors.length||current.rows.some((r,i)=>r.fingerprint!==input.rows[i].fingerprint))throw new HttpError(409,'Dữ liệu đã thay đổi sau preview. Vui lòng xem trước lại.');
    for(const entry of current.rows){
      const row=entry.data;
      if(input.kind==='employees'){
        const parsed=employeeSchema.parse(row);const data={...parsed,joinDate:new Date(parsed.joinDate),exitDate:parsed.exitDate?new Date(parsed.exitDate):null};
        const before=await tx.employee.findUnique({where:{code:data.code}});
        const after=await tx.employee.upsert({where:{code:data.code},create:data,update:data});
        await tx.auditLog.create({data:{actorId,entity:'Employee',entityId:after.id,action:before?'UPDATE':'CREATE',...(before?{before:json(before)}:{}),after:json(after)}});
      }else if(input.kind==='projects'){
        const pm=row.pmCode?await tx.employee.findUniqueOrThrow({where:{code:String(row.pmCode)}}):null;
        const parsed=projectSchema.parse({...row,pmId:pm?.id??null});const data={...parsed,startDate:new Date(parsed.startDate),endDate:new Date(parsed.endDate)};
        const before=await tx.project.findUnique({where:{code:data.code}});const after=await tx.project.upsert({where:{code:data.code},create:data,update:data});
        await tx.auditLog.create({data:{actorId,entity:'Project',entityId:after.id,action:before?'UPDATE':'CREATE',...(before?{before:json(before)}:{}),after:json(after)}});
      }else{
        const employee=await tx.employee.findUniqueOrThrow({where:{code:String(row.employeeCode)}});const project=await tx.project.findUniqueOrThrow({where:{code:String(row.projectCode)}});
        const a=await tx.projectAssignment.findUnique({where:{employeeId_projectId:{employeeId:employee.id,projectId:project.id}}});const where={assignmentId_month:{assignmentId:a?.id??'missing',month:monthStart(String(row.month))}};
        const before=input.kind==='planned'?await tx.monthlyAllocation.findUnique({where}):await tx.monthlyActualEffort.findUnique({where});
        await saveEffortInTransaction(tx,actorId,{employeeId:employee.id,projectId:project.id,month:row.month,kind:input.kind==='planned'?'PLANNED':'ACTUAL',mm:row.mm,expectedVersion:before?.version??null});
      }
    }
    const batch=await tx.importBatch.create({data:{id:input.jti,actorId,kind:input.kind,rowCount:current.rows.length}});
    await tx.auditLog.create({data:{actorId,entity:'ImportBatch',entityId:batch.id,action:'IMPORT',after:json(batch)}});
    return {...batch,replayed:false};
  },{isolationLevel:'Serializable',timeout:30000});
}
export { kindSchema };
