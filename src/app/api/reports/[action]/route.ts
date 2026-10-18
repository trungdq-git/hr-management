import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeWrite, currentUser, HttpError } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { importTemplate, MAX_UPLOAD, parseImport } from '@/lib/excel';
import { commitImport, kindSchema, previewImport } from '@/lib/import-service';
import { auditReport, exportKind, exportReport, reportFilter, workforceReport } from '@/lib/reporting';
export const runtime='nodejs';
const contextSchema=z.object({action:z.string()});
const bodyLimit=1024*1024;
async function limitedBody(request:Request,max:number){
  if(Number(request.headers.get('content-length')??0)>max)throw new HttpError(413,'Yêu cầu vượt giới hạn kích thước');
  if(!request.body)throw new HttpError(400,'Yêu cầu trống');
  const chunks:Uint8Array[]=[];let length=0;const reader=request.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new HttpError(413,'Yêu cầu vượt giới hạn kích thước');}chunks.push(value);}}finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
const excelResponse=(buffer:Buffer,name:string)=>new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${name}.xlsx"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request,context:{params:Promise<{action:string}>}){
  try{
    const user=await currentUser();if(!user)throw new HttpError(401,'Vui lòng đăng nhập');
    const {action}=contextSchema.parse(await context.params);const q=Object.fromEntries(new URL(request.url).searchParams);
    if(action==='template')return excelResponse(await importTemplate(kindSchema.parse(q.kind)),`itrms-template-${q.kind}`);
    if(action==='export')return excelResponse(await exportReport(exportKind.parse(q.kind),q),`itrms-${q.kind}-${reportFilter.parse(q).month}`);
    if(action==='summary')return NextResponse.json(await workforceReport(q),{headers:{'Cache-Control':'private, no-store'}});
    if(action==='audit'){
      if(user.role==='VIEWER')throw new HttpError(403,'Chỉ ADMIN/MANAGER được xem Audit Log');
      return NextResponse.json(await auditReport(q),{headers:{'Cache-Control':'private, no-store'}});
    }
    throw new HttpError(404,'Không tìm thấy thao tác');
  }catch(error){return errorResponse(error);}
}
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
  try{
    const user=await authorizeWrite(request);const {action}=await context.params;
    if(action==='preview'){
      const kind=kindSchema.parse(new URL(request.url).searchParams.get('kind'));
      if(!request.headers.get('content-type')?.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))throw new HttpError(415,'Chỉ nhận XLSX');
      const rows=await parseImport(await limitedBody(request,MAX_UPLOAD),kind);
      return NextResponse.json(await previewImport(user.id,kind,rows));
    }
    if(action==='commit'){
      const body=z.object({token:z.string().min(1).max(bodyLimit)}).parse(JSON.parse((await limitedBody(request,bodyLimit)).toString('utf8')));
      return NextResponse.json(await commitImport(user.id,body.token));
    }
    throw new HttpError(404,'Không tìm thấy thao tác');
  }catch(error){return errorResponse(error);}
}
