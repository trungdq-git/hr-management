import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isoDate } from '@/lib/planning-dates';
import { date, number } from '@/lib/utils';
import { projectStatuses } from '@/lib/labels';
import { PageHeading } from '@/components/page-heading';
import { ProjectRequirements } from '@/components/capabilities/project-requirements';
export default async function ProjectDetail({params}:{params:Promise<{id:string}>}) {
  const user=await requireUser();const {id}=await params;const [p,skills]=await Promise.all([db.project.findUnique({where:{id},include:{requirements:true,pm:{select:{name:true}},_count:{select:{assignments:true}}}}),db.skill.findMany({orderBy:{name:'asc'}})]);if(!p)notFound();
  const project={id:p.id,code:p.code,name:p.name,customer:p.customer,status:p.status,startDate:isoDate(p.startDate),endDate:isoDate(p.endDate),requirements:p.requirements.map(r=>({skillId:r.skillId,minProficiency:r.minProficiency,requiredMm:Number(r.requiredMm),active:r.active,version:r.version}))};
  return <><Link href="/projects" className="mb-5 block text-xs text-muted-foreground">← Danh mục dự án</Link><PageHeading eyebrow={`PROJECT CAPABILITY · ${p.code}`} title={p.name} description={`${p.customer} · ${projectStatuses[p.status]}`}/><div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">{[['Project Manager',p.pm?.name??'Chưa chỉ định'],['Thời gian',`${date(p.startDate)} – ${date(p.endDate)}`],['Contracted MM (tổng)',`${number(Number(p.contractedMm))} MM`],['Nhân sự có assignment',String(p._count.assignments)]].map(([k,v])=><div key={k} className="panel p-5"><p className="text-[11px] text-muted-foreground">{k}</p><p className="mt-3 text-sm font-bold">{v}</p></div>)}</div><ProjectRequirements project={project} skills={skills} canEdit={user.role!=='VIEWER'}/></>;
}
