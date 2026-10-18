import { requireUser } from '@/lib/auth';
import { currentMonth, MONTH_PATTERN } from '@/lib/planning-dates';
import { getForecastData } from '@/lib/forecast-data';
import { ForecastWorkspace } from '@/components/forecast/forecast-workspace';
export default async function ForecastPage({searchParams}:{searchParams:Promise<{month?:string}>}){
  const user=await requireUser();const query=await searchParams;let month=MONTH_PATTERN.test(query.month??'')?query.month!:currentMonth();if(month>'2199-07')month='2199-07';
  return <ForecastWorkspace key={month} data={await getForecastData(month)} canEdit={user.role!=='VIEWER'}/>;
}
