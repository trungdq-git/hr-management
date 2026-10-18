import { db } from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(new URL(request.url).searchParams.get('check')!=='ready')return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});
  try{await db.$queryRaw`SELECT 1`;await db.importBatch.count();return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
