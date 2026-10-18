import { requireUser } from '@/lib/auth';
import { getPlanningData } from '@/lib/planning-data';
import { currentMonth, MONTH_PATTERN } from '@/lib/planning-dates';
import { AllocationMatrix } from '@/components/planning/allocation-matrix';
export default async function AllocationPage({searchParams}:{searchParams:Promise<{month?:string;employee?:string}>}) {
  const user=await requireUser();const query=await searchParams;let month=MONTH_PATTERN.test(query.month??'')?query.month!:currentMonth();
  if(month>'2199-07')month='2199-07';
  return <AllocationMatrix key={`${month}:${query.employee??''}`} data={await getPlanningData(month,6)} canEdit={user.role!=='VIEWER'} initialEmployee={query.employee}/>;
}
