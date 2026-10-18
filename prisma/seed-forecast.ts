import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db } from '../src/lib/db';
import { initializeScenarios, saveDemand, saveProbability } from '../src/lib/forecast-service';
export async function seedForecast(){
  if(process.env.NODE_ENV==='production')throw new Error('Không seed demo trong production');
  const actor=await db.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
  if(await db.employee.count({where:{id:{startsWith:'demo-employee-'},email:{endsWith:'@example.test'}}})!==30)throw new Error('Cần 30 hồ sơ giả từ seed Foundation');
  const scenarios=await initializeScenarios(actor.id);const skills=await db.skill.findMany({where:{active:true}});
  const months=['2026-10','2026-11','2026-12','2027-01','2027-02','2027-03'];const names=['TypeScript','Java','AWS','React','TypeScript','Next.js'];const base=[6,8,4,3,4,3];const step=[0.5,0.5,0.25,0.25,0.5,0.25];
  for(let i=0;i<6;i++){
    const projectId=`demo-project-${i+1}`;const project=await db.project.findUnique({where:{id:projectId}});if(!project||!['ACTIVE','CONFIRMED','PIPELINE'].includes(project.status))continue;
    const skill=skills.find(s=>s.name.toLowerCase()===names[i].toLowerCase());
    for(let m=0;m<months.length;m++){
      const month=months[m];const date=new Date(`${month}-01`);if(project.startDate>new Date(`${month}-28`)||project.endDate<date)continue;
      if(await db.monthlyProjectDemand.findUnique({where:{projectId_month:{projectId,month:date}}}))continue;
      const demandMm=base[i]+step[i]*m;
      await saveDemand(actor.id,{projectId,month,demandMm,expectedVersion:null,skills:skill?[{skillId:skill.id,requiredMm:Math.round(demandMm*0.7*10000)/10000,minProficiency:3}]:[]});
    }
    if(project.status==='PIPELINE')for(const scenario of scenarios){
      if(await db.scenarioProjectProbability.findUnique({where:{scenarioId_projectId:{scenarioId:scenario.id,projectId}}}))continue;
      const probability=(i===4?{CONSERVATIVE:0.15,BASE:0.5,OPTIMISTIC:0.8}:{CONSERVATIVE:0.1,BASE:0.4,OPTIMISTIC:0.75})[scenario.kind];
      await saveProbability(actor.id,{projectId,scenarioId:scenario.id,probability,expectedVersion:null});
    }
  }
  console.log('Seed Phase 4: demand và kỹ năng chính 10/2026–03/2027, xác suất rõ ràng theo 3 kịch bản; giữ bản ghi đã có, có audit.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){seedForecast().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());}
