import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Không seed demo trong production');
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password,'utf8') > 72 || password.startsWith('replace-')) throw new Error('Đặt SEED_DEMO_PASSWORD ít nhất 12 ký tự, tối đa 72 byte UTF-8');
  const passwordHash = await hash(password, 12);
  await db.$transaction(async tx => {
    for (const [email, name, role] of [['admin@example.test','Quản trị Demo','ADMIN'],['manager@example.test','Quản lý Demo','MANAGER'],['viewer@example.test','Người xem Demo','VIEWER']] as const) {
      await tx.user.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash } });
    }
    const surnames = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Vũ'];
    const names = ['Minh An','Gia Bình','Hoài Chi','Anh Dũng','Hà Giang','Tuấn Hải','Mai Hương','Trung Kiên','Bảo Linh','Quang Minh'];
    for (let i = 0; i < 30; i++) {
      const code = `DX-${String(i + 1).padStart(3, '0')}`;
      await tx.employee.upsert({ where: { code }, update: {}, create: { id: `demo-employee-${i+1}`, code, name: `${surnames[Math.floor(i/5)]} ${names[i%10]}`, email: `employee${i+1}@example.test`, position: i < 3 ? 'PM' : i < 6 ? 'BrSE' : i < 9 ? 'TL' : i < 24 ? 'Developer' : 'Tester', level: 2 + i%5, joinDate: new Date(`${2020+i%6}-01-15`), experience: 2 + i%10, location: i%5 === 0 ? 'ONSITE' : 'OFFSHORE', jlpt: i%3 === 0 ? 'N2' : i%3 === 1 ? 'N3' : 'NONE', status: i === 29 ? 'RESIGNED' : i >= 27 ? 'PROBATION' : 'ACTIVE', exitDate: i === 29 ? new Date('2026-09-30') : null, participationRate: i < 3 ? 0.8 : 1 } });
    }
    const projects = [
      ['DX-P001','Sakura Commerce','Sakura Retail','ACTIVE',72,80],
      ['DX-P002','Mirai Banking Platform','Mirai Financial','ACTIVE',120,126],
      ['DX-P003','Hikari Cloud Migration','Hikari Systems','ACTIVE',48,52],
      ['DX-P004','Smart Factory IoT','Koyo Manufacturing','CONFIRMED',60,64],
      ['DX-P005','AI Customer Assistant','Aoba Solutions','PIPELINE',0,36],
      ['DX-P006','Healthcare Portal','Midori Healthcare','PIPELINE',0,48],
      ['DX-P007','Logistics Analytics','Tsubasa Logistics','COMPLETED',32,32],
      ['DX-P008','Legacy Modernization','Nami Technology','CANCELLED',0,0],
    ] as const;
    for (let i = 0; i < projects.length; i++) {
      const [code,name,customer,status,contractedMm,forecastMm] = projects[i];
      await tx.project.upsert({ where: { code }, update: {}, create: { id: `demo-project-${i+1}`, code,name,customer,status,contractedMm,forecastMm,pmId:`demo-employee-${i%3+1}`,startDate:new Date(i===6 ? '2025-06-01' : i===4 || i===5 ? '2026-12-01' : '2026-08-01'),endDate:new Date(i===6 ? '2026-06-30' : '2027-06-30') } });
    }
    // No invented capacity or allocation: calendar and planning UI belong to Phase 2.
    const skillNames = ['TypeScript','Java','React','Next.js','AWS','PostgreSQL','Playwright','GitHub Copilot','Scrum','Japanese'];
    const categories = ['LANGUAGE','LANGUAGE','FRAMEWORK','FRAMEWORK','CLOUD','DATABASE','TESTING','AI_TOOLS','MANAGEMENT','JAPANESE'] as const;
    for (let i=0;i<skillNames.length;i++) {
      const skill = await tx.skill.upsert({ where: { name: skillNames[i] }, update: {}, create: { name: skillNames[i], category: categories[i] } });
      for (let j=0;j<30;j++) if ((i+j)%3===0) await tx.employeeSkill.upsert({ where: { employeeId_skillId: { employeeId: `demo-employee-${j+1}`, skillId: skill.id } }, update: {}, create: { employeeId:`demo-employee-${j+1}`, skillId:skill.id, proficiency:2+j%4 } });
    }
    for (let i=0;i<24;i++) await tx.projectAssignment.upsert({ where: { employeeId_projectId: { employeeId:`demo-employee-${i+1}`, projectId:`demo-project-${i%3+1}` } }, update: {}, create: { employeeId:`demo-employee-${i+1}`, projectId:`demo-project-${i%3+1}` } });
    for (const [name,kind] of [['Conservative','CONSERVATIVE'],['Base','BASE'],['Optimistic','OPTIMISTIC']] as const) await tx.forecastScenario.upsert({ where: { name }, update: {}, create: { name,kind } });
  }, { timeout: 60000 });
  console.log('Seed hoàn thành: 30 nhân viên, 8 dự án, 3 tài khoản demo. Chạy lại không ghi đè dữ liệu đã chỉnh sửa.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
