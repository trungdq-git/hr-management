import 'dotenv/config';
import { db } from '../src/lib/db';
const [actorEmail,targetEmail]=process.argv.slice(2);
try{
  if(!actorEmail||!targetEmail)throw new Error('Dùng: npm run auth:revoke -- admin-email target-email');
  await db.$transaction(async tx=>{
    const actor=await tx.user.findUniqueOrThrow({where:{email:actorEmail}});
    if(!actor.active||actor.role!=='ADMIN')throw new Error('Actor phải là ADMIN đang hoạt động');
    const before=await tx.user.findUniqueOrThrow({where:{email:targetEmail},select:{id:true,sessionVersion:true}});
    const after=await tx.user.update({where:{id:before.id},data:{sessionVersion:{increment:1}},select:{id:true,sessionVersion:true}});
    await tx.auditLog.create({data:{actorId:actor.id,entity:'User',entityId:after.id,action:'REVOKE_SESSIONS',before,after}});
  });console.log('Đã thu hồi toàn bộ phiên của tài khoản đích.');
}catch(error){console.error(error instanceof Error?error.message:'Không thể thu hồi phiên');process.exitCode=1;}finally{await db.$disconnect();}
