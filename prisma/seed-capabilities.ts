import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { db } from '../src/lib/db';
import { saveRating, saveRequirement } from '../src/lib/capability-service';
export async function seedCapabilities() {
  if(process.env.NODE_ENV==='production')throw new Error('Không seed demo trong production');
  const actor=await db.user.findUniqueOrThrow({where:{email:'admin@example.test'}});
  if(await db.employee.count({where:{id:{startsWith:'demo-employee-'},email:{endsWith:'@example.test'}}})!==30)throw new Error('Cần 30 hồ sơ giả từ db:seed trước');
  const skills=await db.skill.findMany({where:{active:true}});
  const skillId=(name:string)=>skills.find(s=>s.name.toLowerCase()===name.toLowerCase())?.id;
  const ratings=[['demo-employee-10','TypeScript',4],['demo-employee-10','React',4],['demo-employee-10','AWS',3],['demo-employee-11','TypeScript',4],['demo-employee-11','React',4],['demo-employee-8','TypeScript',5],['demo-employee-8','React',4],['demo-employee-12','Java',4],['demo-employee-12','AWS',4],['demo-employee-13','AWS',4],['demo-employee-13','PostgreSQL',4]] as const;
  for(const [employeeId,name,proficiency] of ratings){const id=skillId(name);if(!id)continue;const before=await db.employeeSkill.findUnique({where:{employeeId_skillId:{employeeId,skillId:id}}});if(!before)await saveRating(actor.id,{employeeId,skillId:id,proficiency,active:true,expectedVersion:null});}
  const requirements=[['demo-project-1','TypeScript',3,72],['demo-project-1','React',3,72],['demo-project-2','Java',3,120],['demo-project-2','AWS',3,120],['demo-project-3','AWS',3,48],['demo-project-3','PostgreSQL',3,48],['demo-project-4','React',3,60],['demo-project-4','Playwright',3,24],['demo-project-5','TypeScript',3,36],['demo-project-5','GitHub Copilot',3,36],['demo-project-6','Next.js',3,48],['demo-project-6','AWS',3,48]] as const;
  for(const [projectId,name,minProficiency,requiredMm] of requirements){const id=skillId(name);if(!id||!await db.project.findUnique({where:{id:projectId}}))continue;const before=await db.projectSkillRequirement.findUnique({where:{projectId_skillId:{projectId,skillId:id}}});if(!before)await saveRequirement(actor.id,{projectId,skillId:id,minProficiency,requiredMm,active:true,expectedVersion:null});}
  console.log('Seed Phase 3: đánh giá kỹ năng và yêu cầu 6 dự án giả; có audit, không ghi đè bản ghi hiện có.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){seedCapabilities().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());}
