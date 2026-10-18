import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Directory } from '@/components/directory';
export default async function EmployeesPage() { const user=await requireUser();const employees=await db.employee.findMany({orderBy:{code:'asc'}});return <Directory canEdit={user.role!=='VIEWER'} rows={employees.map(e=>({...e,joinDate:e.joinDate.toISOString().slice(0,10),exitDate:e.exitDate?.toISOString().slice(0,10)??null,experience:Number(e.experience),participationRate:Number(e.participationRate)}))}/>; }
