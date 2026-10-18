import { requireUser } from '@/lib/auth';
import { getCapabilityData } from '@/lib/capability-data';
import { currentMonth, MONTH_PATTERN } from '@/lib/planning-dates';
import { CapabilityWorkspace } from '@/components/capabilities/capability-workspace';
export default async function SkillsPage({searchParams}:{searchParams:Promise<{month?:string;tab?:string;project?:string;employee?:string}>}) {
  const user=await requireUser();const query=await searchParams;const month=MONTH_PATTERN.test(query.month??'')?query.month!:currentMonth();const tab=['matrix','search','catalog'].includes(query.tab??'')?query.tab!:'matrix';
  return <CapabilityWorkspace key={`${month}:${tab}:${query.project??''}:${query.employee??''}`} data={await getCapabilityData(month)} canEdit={user.role!=='VIEWER'} initialTab={tab} initialProject={query.project} initialEmployee={query.employee}/>;
}
