import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Portfolio } from '@/components/portfolio';
export default async function ProjectsPage() {
  const user=await requireUser();const [projects,managers]=await Promise.all([db.project.findMany({orderBy:{code:'asc'},include:{pm:{select:{name:true}},_count:{select:{assignments:true}}}}),db.employee.findMany({where:{position:'PM',status:{not:'RESIGNED'}},select:{id:true,name:true}})]);
  return <Portfolio canEdit={user.role!=='VIEWER'} managers={managers} rows={projects.map(p=>({id:p.id,code:p.code,name:p.name,customer:p.customer,pmId:p.pmId,pmName:p.pm?.name??'Chưa chỉ định',startDate:p.startDate.toISOString().slice(0,10),endDate:p.endDate.toISOString().slice(0,10),status:p.status,contractedMm:Number(p.contractedMm),forecastMm:Number(p.forecastMm),headcount:p._count.assignments}))}/>;
}
