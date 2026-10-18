import { requireUser } from '@/lib/auth';
import { getPlanningData } from '@/lib/planning-data';
import { currentMonth, MONTH_PATTERN } from '@/lib/planning-dates';
import { CapacityPlanning } from '@/components/planning/capacity-planning';
export default async function CapacityPage({searchParams}:{searchParams:Promise<{month?:string;tab?:string}>}) {
  const user=await requireUser();const query=await searchParams;const month=MONTH_PATTERN.test(query.month??'')?query.month!:currentMonth();
  const tab=['calendar','people','absences'].includes(query.tab??'')?query.tab!:'calendar';
  return <CapacityPlanning key={`${month}:${tab}`} data={await getPlanningData(month,1)} canEdit={user.role!=='VIEWER'} initialTab={tab}/>;
}
