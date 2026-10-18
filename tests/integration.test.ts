import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const cookie = vi.hoisted(()=>({token:''}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>cookie.token?{value:cookie.token}:undefined})}));
import { db } from '../src/lib/db';
import { signSession } from '../src/lib/session';
import { saveEmployee } from '../src/lib/services';
import { POST as login } from '../src/app/api/auth/login/route';
import { POST as createEmployee } from '../src/app/api/employees/route';
import { PATCH as updateEmployee } from '../src/app/api/employees/[id]/route';
import { POST as createProject } from '../src/app/api/projects/route';
import { PATCH as updateProject } from '../src/app/api/projects/[id]/route';
import { dashboardData } from '../src/lib/dashboard';
import { POST as planningWrite, GET as planningRead } from '../src/app/api/planning/[action]/route';
import { getPlanningData } from '../src/lib/planning-data';
import { saveEffort, saveCalendarMonth } from '../src/lib/planning-service';
import { weekdayTemplate } from '../src/lib/planning-dates';
import { seedPlanning } from '../prisma/seed-planning';
import { POST as capabilityWrite, GET as capabilityRead } from '../src/app/api/capabilities/[action]/route';
import { saveSkill, saveRating, saveRequirement } from '../src/lib/capability-service';
import { searchResources } from '../src/lib/capability-data';
import { seedCapabilities } from '../prisma/seed-capabilities';
import { POST as forecastWrite, GET as forecastRead } from '../src/app/api/forecast/[action]/route';
import { saveDemand, saveProbability } from '../src/lib/forecast-service';
import { getForecastData } from '../src/lib/forecast-data';
import { seedForecast } from '../prisma/seed-forecast';
import { GET as reportRead, POST as reportWrite } from '../src/app/api/reports/[action]/route';
import { previewImport, commitImport } from '../src/lib/import-service';
import { workforceReport, exportReport, auditReport } from '../src/lib/reporting';
import { workbookBuffer, importColumns, parseImport } from '../src/lib/excel';
import { loginAttempt } from '../src/lib/login-throttle';
import { currentUser } from '../src/lib/auth';
import { GET as health } from '../src/app/api/health/route';
import { POST as logout } from '../src/app/api/auth/logout/route';
import ExcelJS from 'exceljs';
import { SignJWT } from 'jose';
const run = promisify(execFile);
const password='Demo-Test-Password-2026!';
const postgresMessages:string[]=[];let postgresStarted=false;
const pg=new EmbeddedPostgres({databaseDir:resolve('.tools',`pg-test-${randomUUID()}`),user:'itrms_test',password:'test_local_only',port:Number(new URL(process.env.DATABASE_URL!).port),persistent:true,postgresFlags:['-h','127.0.0.1'],initdbFlags:['--locale=C','--encoding=UTF8'],onLog:message=>postgresMessages.push(String(message)),onError:message=>postgresMessages.push(String(message))});
const request=(url:string,body:unknown,method='POST',origin='http://localhost:3000')=>new Request(`http://localhost:3000${url}`,{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const employee={code:'DX-NEW',name:'Nhân viên Kiểm thử',email:'new-employee@example.test',position:'Developer',level:3,joinDate:'2026-10-01',exitDate:null,experience:4,location:'OFFSHORE',jlpt:'N3',status:'ACTIVE',participationRate:1};
let adminId:string;let managerId:string;let viewerId:string;
beforeAll(async()=>{
  try { await pg.initialise();await pg.start();postgresStarted=true; }
  catch(error){throw new Error(`PostgreSQL test startup failed: ${String(error)}\n${postgresMessages.slice(-12).join('\n')}`);}
  await pg.createDatabase('itrms_test');
  await run(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:process.env});
  await run(process.execPath,['node_modules/tsx/dist/cli.mjs','prisma/seed.ts'],{env:{...process.env,SEED_DEMO_PASSWORD:password}});
  await run(process.execPath,['node_modules/tsx/dist/cli.mjs','prisma/seed.ts'],{env:{...process.env,SEED_DEMO_PASSWORD:password}});
  adminId=(await db.user.findUniqueOrThrow({where:{email:'admin@example.test'}})).id;
  managerId=(await db.user.findUniqueOrThrow({where:{email:'manager@example.test'}})).id;
  viewerId=(await db.user.findUniqueOrThrow({where:{email:'viewer@example.test'}})).id;
});
afterAll(async()=>{await db.$disconnect();if(postgresStarted)await pg.stop();});
beforeEach(()=>{cookie.token='';});
describe('PostgreSQL + Prisma + API integration',()=>{
  it('applies versioned migrations and seeds exactly 30 employees / 8 projects idempotently',async()=>{expect(await db.employee.count()).toBe(30);expect(await db.project.count()).toBe(8);expect(await db.user.count()).toBe(3);});
  it('authenticates seeded account, signs HttpOnly session and records login',async()=>{
    const response=await login(request('/api/auth/login',{email:'admin@example.test',password}));expect(response.status).toBe(200);expect(response.headers.get('set-cookie')).toContain('HttpOnly');expect(response.cookies.get('dx_session')?.value).toBeTruthy();expect(await db.auditLog.count({where:{action:'LOGIN'}})).toBe(1);
  });
  it('rejects wrong password and cross-origin login',async()=>{expect((await login(request('/api/auth/login',{email:'admin@example.test',password:'wrong'}))).status).toBe(401);expect((await login(request('/api/auth/login',{email:'admin@example.test',password},'POST','https://evil.test'))).status).toBe(403);});
  it('requires authentication and denies VIEWER mutations',async()=>{expect((await createEmployee(request('/api/employees',employee))).status).toBe(401);cookie.token=await signSession(viewerId);expect((await createEmployee(request('/api/employees',employee))).status).toBe(403);});
  it('ADMIN creates employee; MANAGER updates; snapshots retain before and after',async()=>{
    cookie.token=await signSession(adminId);const response=await createEmployee(request('/api/employees',employee));expect(response.status).toBe(201);const created=await response.json();
    cookie.token=await signSession(managerId);expect((await updateEmployee(request(`/api/employees/${created.id}`,{...employee,level:4},'PATCH'),{params:Promise.resolve({id:created.id})})).status).toBe(200);
    const logs=await db.auditLog.findMany({where:{entityId:created.id},orderBy:{createdAt:'asc'}});expect(logs).toHaveLength(2);expect(logs[1].before).toMatchObject({level:3});expect(logs[1].after).toMatchObject({level:4});
  });
  it('rejects duplicates, invalid dates, negative values and cross-origin writes',async()=>{
    cookie.token=await signSession(adminId);expect((await createEmployee(request('/api/employees',employee))).status).toBe(409);
    expect((await createEmployee(request('/api/employees',{...employee,experience:-1}))).status).toBe(400);
    expect((await createEmployee(request('/api/employees',{...employee,joinDate:'2026-02-30'}))).status).toBe(400);
    expect((await createEmployee(request('/api/employees',employee,'POST','https://evil.test'))).status).toBe(403);
  });
  it('returns 404 on updates for missing employee',async()=>{cookie.token=await signSession(adminId);expect((await updateEmployee(request('/api/employees/missing',employee,'PATCH'),{params:Promise.resolve({id:'missing'})})).status).toBe(404);});
  it('rolls back data when audit fails',async()=>{await expect(saveEmployee('missing-actor',{...employee,code:'ROLLBACK',email:'rollback@example.test'})).rejects.toThrow();expect(await db.employee.count({where:{code:'ROLLBACK'}})).toBe(0);});
  it('creates and updates project with audited status changes; validates PM and MM',async()=>{
    cookie.token=await signSession(managerId);
    const data={code:'DX-TEST',name:'Dự án Kiểm thử',customer:'Demo Customer',pmId:'demo-employee-1',startDate:'2026-10-01',endDate:'2027-01-31',status:'PIPELINE',contractedMm:0,forecastMm:12};
    const r=await createProject(request('/api/projects',data));expect(r.status).toBe(201);const p=await r.json();
    expect((await updateProject(request(`/api/projects/${p.id}`,{...data,status:'CONFIRMED',contractedMm:10},'PATCH'),{params:Promise.resolve({id:p.id})})).status).toBe(200);
    expect(await db.auditLog.count({where:{entityId:p.id}})).toBe(2);
    expect((await createProject(request('/api/projects',{...data,code:'BAD-PM',pmId:'demo-employee-10'}))).status).toBe(400);
    expect((await createProject(request('/api/projects',{...data,contractedMm:-1}))).status).toBe(400);
    expect((await createProject(request('/api/projects',{...data,endDate:'2026-09-01'}))).status).toBe(400);
  });
  it('SQL prevents duplicate monthly allocation, negative MM and non-month dates',async()=>{
    const a=await db.projectAssignment.findUniqueOrThrow({where:{employeeId_projectId:{employeeId:'demo-employee-1',projectId:'demo-project-1'}}});await db.monthlyAllocation.create({data:{assignmentId:a.id,month:new Date('2026-10-01'),plannedMm:1.2}});
    await expect(db.monthlyAllocation.create({data:{assignmentId:a.id,month:new Date('2026-10-01'),plannedMm:0.5}})).rejects.toThrow();
    await expect(db.monthlyAllocation.create({data:{assignmentId:a.id,month:new Date('2026-11-01'),plannedMm:-0.1}})).rejects.toThrow();
    await expect(db.monthlyAllocation.create({data:{assignmentId:a.id,month:new Date('2026-11-02'),plannedMm:0.5}})).rejects.toThrow();
    expect(await db.monthlyActualEffort.count()).toBe(0);
  });
  it('keeps assignment history and prevents audit mutation',async()=>{
    await expect(db.employee.delete({where:{id:'demo-employee-1'}})).rejects.toThrow();
    const log=await db.auditLog.findFirstOrThrow();await expect(db.auditLog.delete({where:{id:log.id}})).rejects.toThrow();
  });
  it('invalidates sessions of disabled accounts',async()=>{await db.user.update({where:{id:viewerId},data:{active:false}});cookie.token=await signSession(viewerId);expect((await createEmployee(request('/api/employees',employee))).status).toBe(401);});
  it('dashboard distinguishes missing capacity, applies filters and excludes resigned employees',async()=>{
    const all=await dashboardData({month:'2026-10'});expect(all.complete).toBe(false);expect(all.employees.some(e=>e.code==='DX-030')).toBe(false);
    const selected=await dashboardData({month:'2026-10',position:'PM',location:'ONSITE'});expect(selected.employees).toHaveLength(1);expect(selected.employees[0].code).toBe('DX-001');
  });
  it('derives capacity from complete calendar and absence, and detects total overload',async()=>{
    const calendar=await db.workingCalendar.create({data:{name:'Test Calendar'}});
    await db.calendarMonth.create({data:{calendarId:calendar.id,month:new Date('2026-10-01'),standardDays:22}});
    await db.calendarDay.createMany({data:Array.from({length:31},(_,i)=>{const date=new Date(Date.UTC(2026,9,i+1));return {calendarId:calendar.id,date,workingFraction:[0,6].includes(date.getUTCDay())?0:1};})});
    await db.employee.update({where:{id:'demo-employee-1'},data:{calendarId:calendar.id}});
    await db.employeeAbsence.create({data:{employeeId:'demo-employee-1',date:new Date('2026-10-01'),fraction:1,reason:'Phép demo'}});
    const data=await dashboardData({month:'2026-10',position:'PM',location:'ONSITE'});
    expect(data.complete).toBe(true);expect(data.totalCapacity).toBe(0.7636);expect(data.totalAllocated).toBe(1.2);expect(data.overallocated).toBe(1);
  });
});

describe('Phase 2 planning API and PostgreSQL integration',()=>{
  let calendarId:string;
  const context=(action:string)=>({params:Promise.resolve({action})});
  const write=(action:string,body:unknown)=>planningWrite(request(`/api/planning/${action}`,body),context(action));
  const month='2026-11';const employeeId='demo-employee-10';
  it('protects planning reads/writes with auth, RBAC and Origin',async()=>{
    expect((await write('calendars',{name:'Unauthorized'})).status).toBe(401);
    expect((await planningRead(new Request('http://localhost:3000/api/planning/history'),context('history'))).status).toBe(401);
    await db.user.update({where:{id:viewerId},data:{active:true}});cookie.token=await signSession(viewerId);
    expect((await write('calendars',{name:'Denied'})).status).toBe(403);
    expect((await planningRead(new Request('http://localhost:3000/api/planning/history'),context('history'))).status).toBe(200);
    cookie.token=await signSession(adminId);
    expect((await planningWrite(request('/api/planning/calendars',{name:'Bad Origin'},'POST','https://evil.test'),context('calendars'))).status).toBe(403);
  });
  it('creates calendar and complete month; rejects incomplete days, invalid month and stale versions',async()=>{
    cookie.token=await signSession(managerId);
    const created=await write('calendars',{name:'Phase2 Integration'});expect(created.status).toBe(200);calendarId=(await created.json()).id;
    const data={calendarId,month,standardDays:21,expectedVersion:null,days:weekdayTemplate(month)};
    expect((await write('calendar-month',{...data,days:data.days.slice(1)})).status).toBe(400);
    expect((await write('calendar-month',{...data,month:'bad'})).status).toBe(400);
    expect((await write('calendar-month',data)).status).toBe(200);
    expect((await write('calendar-month',data)).status).toBe(409);
    expect((await write('calendar-month',{...data,standardDays:20,expectedVersion:1})).status).toBe(200);
    expect(await db.calendarDay.count({where:{calendarId}})).toBe(30);
    expect(await db.auditLog.count({where:{entity:'CalendarMonth',entityId:`${calendarId}:${month}`}})).toBe(2);
  });
  it('assigns monthly settings in bulk; conflicts roll back all employees and preserve other months',async()=>{
    cookie.token=await signSession(adminId);
    const entry={employeeId,participationRate:0.8,expectedVersion:null};
    expect((await write('settings',{month,calendarId,employees:[entry]})).status).toBe(200);
    const conflict=await write('settings',{month,calendarId,employees:[{employeeId:'demo-employee-1',participationRate:1,expectedVersion:null},entry]});expect(conflict.status).toBe(409);
    expect(await db.employeeCapacitySetting.count({where:{employeeId:'demo-employee-1',month:new Date('2026-11-01')}})).toBe(0);
    const data=await getPlanningData('2026-10',2,employeeId);expect(data.employees[0].months[0].capacity).toBeNull();expect(data.employees[0].months[1].capacity).toBe(0.84);
  });
  it('leave and unavailable reduce capacity; cancellation retains version and audit',async()=>{
    cookie.token=await signSession(managerId);
    const data={employeeId,date:'2026-11-02',fraction:0.5,kind:'LEAVE',reason:'Phép test',expectedVersion:null};
    expect((await write('absences',data)).status).toBe(200);
    expect((await getPlanningData(month,1,employeeId)).employees[0].months[0].capacity).toBe(0.82);
    expect((await write('absences',{...data,kind:'UNAVAILABLE',fraction:1,expectedVersion:1})).status).toBe(200);
    expect((await getPlanningData(month,1,employeeId)).employees[0].months[0].capacity).toBe(0.8);
    expect((await write('absences',{...data,fraction:0,expectedVersion:2})).status).toBe(200);
    expect((await write('absences',{...data,expectedVersion:1})).status).toBe(409);
    expect((await getPlanningData(month,1,employeeId)).employees[0].months[0].capacity).toBe(0.84);
  });
  it('saves multiple projects, allows overload, separates actual and produces queryable history',async()=>{
    cookie.token=await signSession(managerId);
    const planned={employeeId,projectId:'demo-project-1',month,kind:'PLANNED',mm:0.6,expectedVersion:null};
    expect((await write('effort',planned)).status).toBe(200);
    expect((await write('effort',{...planned,projectId:'demo-project-2',mm:0.5})).status).toBe(200);
    expect((await write('effort',{...planned,kind:'ACTUAL',mm:0.25})).status).toBe(200);
    let data=(await getPlanningData(month,1,employeeId)).employees[0];expect(data.months[0]).toMatchObject({capacity:0.84,allocated:1.1,actual:0.25,overallocated:true,available:-0.26});
    expect(data.efforts.find(f=>f.projectId==='demo-project-2')?.actual).toBeNull();
    expect((await write('effort',{...planned,mm:0,expectedVersion:1})).status).toBe(200);
    data=(await getPlanningData(month,1,employeeId)).employees[0];expect(data.months[0].actual).toBe(0.25);expect(data.months[0].allocated).toBe(0.5);
    const history=await planningRead(new Request(`http://localhost:3000/api/planning/history?employeeId=${employeeId}&month=${month}&projectId=demo-project-1`),context('history'));
    expect(history.status).toBe(200);expect(await history.json()).toHaveLength(3);
  });
  it('prevents lost updates with concurrent edits and stale create requests',async()=>{
    cookie.token=await signSession(adminId);
    const input={employeeId,projectId:'demo-project-2',month,kind:'PLANNED',mm:0.4,expectedVersion:1};
    const results=await Promise.all([write('effort',input),write('effort',{...input,mm:0.3})]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    expect((await write('effort',{...input,expectedVersion:null})).status).toBe(409);
  });
  it('validates negative MM, pipeline, cancelled planned, employment and project windows',async()=>{
    cookie.token=await signSession(adminId);const input={employeeId,projectId:'demo-project-1',month,kind:'PLANNED',mm:1,expectedVersion:null};
    for(const change of [{mm:-0.1},{mm:0.12345},{projectId:'demo-project-5'},{projectId:'demo-project-8'},{employeeId:'demo-employee-30'},{month:'2028-01'}])expect((await write('effort',{...input,...change})).status).toBe(400);
    const late=await db.employee.create({data:{code:'LATE-JOIN',name:'Demo Late Join',email:'late@example.test',position:'Developer',level:2,joinDate:new Date('2026-11-20'),experience:1}});
    const early=await db.project.create({data:{code:'EARLY-END',name:'Demo Early End',customer:'Test',startDate:new Date('2026-11-01'),endDate:new Date('2026-11-10'),status:'ACTIVE',contractedMm:1,forecastMm:1}});
    expect((await write('effort',{...input,employeeId:late.id,projectId:early.id})).status).toBe(400);
    expect((await write('absences',{employeeId:'demo-employee-30',date:'2026-11-01',fraction:1,reason:'Test',kind:'LEAVE',expectedVersion:null})).status).toBe(400);
  });
  it('rolls back allocation/calendar changes if audit cannot be written',async()=>{
    await expect(saveEffort('invalid-actor',{employeeId,projectId:'demo-project-3',month,kind:'PLANNED',mm:0.2,expectedVersion:null})).rejects.toThrow();
    const a=await db.projectAssignment.findUnique({where:{employeeId_projectId:{employeeId,projectId:'demo-project-3'}}});expect(a).toBeNull();
    await expect(saveCalendarMonth('invalid-actor',{calendarId,month,standardDays:19,expectedVersion:2,days:weekdayTemplate(month)})).rejects.toThrow();
    expect(Number((await db.calendarMonth.findUniqueOrThrow({where:{calendarId_month:{calendarId,month:new Date('2026-11-01')}}})).standardDays)).toBe(20);
  });
  it('database enforces setting month, rate and uniqueness',async()=>{
    await expect(db.employeeCapacitySetting.create({data:{employeeId,calendarId,month:new Date('2026-12-02'),participationRate:1}})).rejects.toThrow();
    await expect(db.employeeCapacitySetting.create({data:{employeeId,calendarId,month:new Date('2026-12-01'),participationRate:1.1}})).rejects.toThrow();
    await expect(db.employeeCapacitySetting.create({data:{employeeId,calendarId,month:new Date('2026-11-01'),participationRate:1}})).rejects.toThrow();
  });
  it('Phase 2 seed is idempotent, audited and preserves existing effort/settings',async()=>{
    const before=await db.employeeCapacitySetting.findUniqueOrThrow({where:{employeeId_month:{employeeId,month:new Date('2026-11-01')}}});
    await seedPlanning();const counts=[await db.monthlyAllocation.count(),await db.monthlyActualEffort.count(),await db.auditLog.count()];await seedPlanning();expect([await db.monthlyAllocation.count(),await db.monthlyActualEffort.count(),await db.auditLog.count()]).toEqual(counts);
    const after=await db.employeeCapacitySetting.findUniqueOrThrow({where:{employeeId_month:{employeeId,month:new Date('2026-11-01')}}});expect(after).toEqual(before);
    expect((await getPlanningData('2026-10')).months.at(-1)).toBe('2027-03');
  });
});
describe('Phase 3 capability API and PostgreSQL integration',()=>{
  let skillId:string;
  const context=(action:string)=>({params:Promise.resolve({action})});
  const write=(action:string,body:unknown)=>capabilityWrite(request(`/api/capabilities/${action}`,body),context(action));
  const baseFilters={month:'2026-10',query:'',position:'',location:'',minLevel:1,maxLevel:6,jlpt:'ANY',mode:'ALL',skills:[],availability:'ANY',minAvailableMm:0};
  const read=(filters:unknown)=>capabilityRead(new Request(`http://localhost:3000/api/capabilities/search?${new URLSearchParams({filters:JSON.stringify(filters)})}`),context('search'));
  const employeeId='demo-employee-10';const projectId='demo-project-1';
  it('enforces auth/role/Origin but allows VIEWER resource search',async()=>{
    expect((await write('skills',{})).status).toBe(401);expect((await read(baseFilters)).status).toBe(401);
    cookie.token=await signSession(viewerId);expect((await write('skills',{})).status).toBe(403);expect((await read(baseFilters)).status).toBe(200);
    cookie.token=await signSession(adminId);expect((await capabilityWrite(request('/api/capabilities/skills',{},'POST','https://evil.test'),context('skills'))).status).toBe(403);
  });
  it('creates normalized catalog and rejects case/whitespace duplicate and invalid values',async()=>{
    cookie.token=await signSession(managerId);const response=await write('skills',{name:'  Cobol   Lab  ',category:'LANGUAGE',active:true,expectedVersion:null});expect(response.status).toBe(200);const skill=await response.json();skillId=skill.id;expect(skill.name).toBe('Cobol Lab');
    expect((await write('skills',{name:'cobol LAB',category:'LANGUAGE',active:true,expectedVersion:null})).status).toBe(409);
    expect((await write('skills',{name:'   ',category:'LANGUAGE',active:true,expectedVersion:null})).status).toBe(400);
    expect((await write('skills',{name:'Bad',category:'UNKNOWN',active:true,expectedVersion:null})).status).toBe(400);
  });
  it('creates/updates/removes/restores rating with monotonic version and snapshots',async()=>{
    cookie.token=await signSession(managerId);const data={employeeId,skillId,proficiency:3,active:true,expectedVersion:null};
    expect((await write('ratings',data)).status).toBe(200);expect((await write('ratings',{...data,proficiency:4,expectedVersion:1})).status).toBe(200);expect((await write('ratings',{...data,proficiency:4,active:false,expectedVersion:2})).status).toBe(200);
    expect((await write('ratings',{...data,expectedVersion:1})).status).toBe(409);expect((await write('ratings',{...data,proficiency:5,expectedVersion:3})).status).toBe(200);
    expect((await write('ratings',{...data,proficiency:0,expectedVersion:4})).status).toBe(400);
    const logs=await db.auditLog.findMany({where:{entity:'EmployeeSkill',entityId:`${employeeId}:${skillId}`},orderBy:{createdAt:'asc'}});expect(logs).toHaveLength(4);expect(logs[2].after).toMatchObject({active:false,version:3});expect(logs[3].before).toMatchObject({active:false,version:3});
  });
  it('prevents concurrent lost updates and keeps one rating per employee/skill',async()=>{
    cookie.token=await signSession(adminId);const data={employeeId,skillId,proficiency:4,active:true,expectedVersion:4};const results=await Promise.all([write('ratings',data),write('ratings',{...data,proficiency:3})]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(await db.employeeSkill.count({where:{employeeId,skillId}})).toBe(1);
  });
  it('saves project requirements, blocks referenced catalog archive and preserves removal history',async()=>{
    cookie.token=await signSession(managerId);const data={projectId,skillId,minProficiency:3,requiredMm:2.5,active:true,expectedVersion:null};expect((await write('requirements',data)).status).toBe(200);
    const skill=await db.skill.findUniqueOrThrow({where:{id:skillId}});expect((await write('skills',{...skill,active:false,expectedVersion:skill.version})).status).toBe(409);
    expect((await write('requirements',{...data,minProficiency:4,requiredMm:3,expectedVersion:1})).status).toBe(200);expect((await write('requirements',{...data,active:false,expectedVersion:2})).status).toBe(200);expect((await write('requirements',{...data,expectedVersion:1})).status).toBe(409);
    expect(await db.projectSkillRequirement.count({where:{projectId,skillId}})).toBe(1);expect(await db.auditLog.count({where:{entity:'ProjectSkillRequirement',entityId:`${projectId}:${skillId}`}})).toBe(3);
  });
  it('archives/restores catalog without deleting ratings; archived filters are rejected',async()=>{
    cookie.token=await signSession(adminId);let skill=await db.skill.findUniqueOrThrow({where:{id:skillId}});expect((await write('skills',{...skill,active:false,expectedVersion:skill.version})).status).toBe(200);
    expect((await write('ratings',{employeeId,skillId,proficiency:4,active:true,expectedVersion:5})).status).toBe(400);
    expect((await read({...baseFilters,skills:[{skillId,minProficiency:1}]})).status).toBe(400);
    expect(await db.employeeSkill.count({where:{employeeId,skillId,active:true}})).toBe(1);
    skill=await db.skill.findUniqueOrThrow({where:{id:skillId}});expect((await write('skills',{...skill,active:true,expectedVersion:skill.version})).status).toBe(200);expect((await read({...baseFilters,skills:[{skillId,minProficiency:1}]})).status).toBe(200);
  });
  it('rolls back catalog/rating/requirement when audit fails',async()=>{
    await expect(saveSkill('missing-actor',{name:'Rollback Skill',category:'CLOUD',active:true,expectedVersion:null})).rejects.toThrow();expect(await db.skill.count({where:{name:'Rollback Skill'}})).toBe(0);
    await expect(saveRating('missing-actor',{employeeId:'demo-employee-11',skillId,proficiency:3,active:true,expectedVersion:null})).rejects.toThrow();expect(await db.employeeSkill.count({where:{employeeId:'demo-employee-11',skillId}})).toBe(0);
    await expect(saveRequirement('missing-actor',{projectId:'demo-project-2',skillId,minProficiency:3,requiredMm:1,active:true,expectedVersion:null})).rejects.toThrow();expect(await db.projectSkillRequirement.count({where:{projectId:'demo-project-2',skillId}})).toBe(0);
  });
  it('validates missing entities, filters, FK, unique and proficiency DB constraints',async()=>{
    cookie.token=await signSession(adminId);expect((await write('ratings',{employeeId:'missing',skillId,proficiency:2,active:true,expectedVersion:null})).status).toBe(404);
    expect((await read({...baseFilters,minLevel:6,maxLevel:1})).status).toBe(400);expect((await read({...baseFilters,projectId:'missing'})).status).toBe(404);expect((await read({...baseFilters,projectId,month:'2028-01'})).status).toBe(400);
    await expect(db.employeeSkill.create({data:{employeeId:'demo-employee-12',skillId,proficiency:6}})).rejects.toThrow();await expect(db.projectSkillRequirement.create({data:{projectId:'demo-project-2',skillId,minProficiency:3,requiredMm:-1}})).rejects.toThrow();await expect(db.skill.create({data:{name:'COBOL LAB',category:'LANGUAGE'}})).rejects.toThrow();
  });
  it('Phase 3 seed is idempotent, audited and preserves removed requirements',async()=>{
    await seedCapabilities();const counts=[await db.employeeSkill.count(),await db.projectSkillRequirement.count(),await db.auditLog.count()];await seedCapabilities();expect([await db.employeeSkill.count(),await db.projectSkillRequirement.count(),await db.auditLog.count()]).toEqual(counts);expect((await db.projectSkillRequirement.findUniqueOrThrow({where:{projectId_skillId:{projectId,skillId}}})).active).toBe(false);
  });
  it('project AND matching uses Phase 2 capacity and excludes overloaded/unknown supply',async()=>{
    const result=await searchResources({...baseFilters,projectId,availability:'AVAILABLE',minAvailableMm:0.1});expect(result.projectRequirements).toHaveLength(2);expect(result.matches.some(m=>m.employee.id==='demo-employee-10')).toBe(true);expect(result.matches.some(m=>m.employee.id==='demo-employee-8')).toBe(false);
    for(const m of result.matches){expect(m.employee.available).toBeGreaterThanOrEqual(0.1);expect(m.projectMatched).toBe(2);}
    const unscoped=await searchResources({...baseFilters,projectId});expect(unscoped.matches.some(m=>m.employee.id==='demo-employee-8')).toBe(true);
    const noRequirements=await searchResources({...baseFilters,projectId:'demo-project-8'});expect(noRequirements.missingProjectRequirements).toBe(true);
    expect(await db.employee.count({where:{id:{startsWith:'demo-employee-'}}})).toBe(30);expect(await db.project.count({where:{id:{startsWith:'demo-project-'}}})).toBe(8);
  });
});
describe('Phase 4 forecast API and PostgreSQL integration',()=>{
  const context=(action:string)=>({params:Promise.resolve({action})});
  const write=(action:string,body:unknown)=>forecastWrite(request(`/api/forecast/${action}`,body),context(action));
  const projectId='demo-project-4';const month='2026-11';let skillId:string;
  it('enforces auth, VIEWER read-only and Origin on forecast endpoints',async()=>{
    expect((await write('demands',{})).status).toBe(401);expect((await forecastRead(new Request('http://localhost:3000/api/forecast/result?month=2026-10'),context('result'))).status).toBe(401);
    cookie.token=await signSession(viewerId);expect((await write('scenarios',{})).status).toBe(403);expect((await forecastRead(new Request('http://localhost:3000/api/forecast/result?month=2026-10'),context('result'))).status).toBe(200);
    cookie.token=await signSession(adminId);expect((await forecastWrite(request('/api/forecast/scenarios',{},'POST','https://evil.test'),context('scenarios'))).status).toBe(403);
  });
  it('initializes exactly three scenarios idempotently without implicit probabilities',async()=>{
    cookie.token=await signSession(managerId);const before=await db.auditLog.count({where:{entity:'ForecastScenario'}});expect((await write('scenarios',{})).status).toBe(200);expect((await write('scenarios',{})).status).toBe(200);expect(await db.forecastScenario.count()).toBe(3);expect(await db.scenarioProjectProbability.count()).toBe(0);expect(await db.auditLog.count({where:{entity:'ForecastScenario'}})).toBe(before);
  });
  it('creates/updates demand and primary-skill work atomically with validation and audit',async()=>{
    cookie.token=await signSession(managerId);skillId=(await db.skill.findUniqueOrThrow({where:{name:'TypeScript'}})).id;
    const data={projectId,month,demandMm:5,skills:[{skillId,minProficiency:3,requiredMm:3}],expectedVersion:null};expect((await write('demands',data)).status).toBe(200);
    expect((await write('demands',{...data,demandMm:2})).status).toBe(400);expect((await write('demands',{...data,demandMm:-1})).status).toBe(400);expect((await write('demands',{...data,month:'2028-01'})).status).toBe(400);expect((await write('demands',{...data,projectId:'demo-project-8'})).status).toBe(400);
    expect((await write('demands',{...data,demandMm:6,skills:[{skillId,minProficiency:4,requiredMm:4}],expectedVersion:1})).status).toBe(200);expect((await write('demands',{...data,expectedVersion:1})).status).toBe(409);
    const row=await db.monthlyProjectDemand.findUniqueOrThrow({where:{projectId_month:{projectId,month:new Date('2026-11-01')}}});const logs=await db.auditLog.findMany({where:{entity:'MonthlyProjectDemand',entityId:row.id},orderBy:{createdAt:'asc'}});expect(logs).toHaveLength(2);expect(logs[1].before).toMatchObject({demandMm:'5',skills:[{requiredMm:'3'}]});expect(logs[1].after).toMatchObject({demandMm:'6',skills:[{requiredMm:'4'}]});
  });
  it('rejects stale concurrent demand writes without duplicating monthly rows',async()=>{
    cookie.token=await signSession(adminId);const data={projectId,month,demandMm:6,skills:[{skillId,minProficiency:3,requiredMm:2}],expectedVersion:2};const results=await Promise.all([write('demands',data),write('demands',{...data,skills:[{skillId,minProficiency:3,requiredMm:4}]})]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(await db.monthlyProjectDemand.count({where:{projectId,month:new Date('2026-11-01')}})).toBe(1);
  });
  it('rolls demand/skill rows back on audit failure and DB rejects cross-row MM overflow',async()=>{
    await expect(saveDemand('missing-actor',{projectId,month:'2026-12',demandMm:2,skills:[{skillId,minProficiency:3,requiredMm:1}],expectedVersion:null})).rejects.toThrow();
    expect(await db.monthlyProjectDemand.count({where:{projectId,month:new Date('2026-12-01')}})).toBe(0);
    await expect(db.monthlyProjectDemand.create({data:{projectId,month:new Date('2026-12-01'),demandMm:1,skills:{create:{skillId,requiredMm:2,minProficiency:3}}}})).rejects.toThrow();
    expect(await db.monthlyProjectDemand.count({where:{projectId,month:new Date('2026-12-01')}})).toBe(0);
  });
  it('blocks catalog archive for a monthly skill demand and allows clearing with audit',async()=>{
    const skill=await saveSkill(adminId,{name:'Forecast Isolated Skill',category:'CLOUD',active:true,expectedVersion:null});
    await saveDemand(adminId,{projectId,month:'2027-05',demandMm:1,skills:[{skillId:skill.id,minProficiency:3,requiredMm:1}],expectedVersion:null});
    await expect(saveSkill(adminId,{...skill,active:false,expectedVersion:1})).rejects.toMatchObject({status:409});
    await saveDemand(adminId,{projectId,month:'2027-05',demandMm:0,skills:[],expectedVersion:1});expect((await saveSkill(adminId,{...skill,active:false,expectedVersion:1})).active).toBe(false);
  });
  it('validates probability ordering and preserves null/zero with monotonic version',async()=>{
    cookie.token=await signSession(managerId);const [conservative,base,optimistic]=await Promise.all(['CONSERVATIVE','BASE','OPTIMISTIC'].map(kind=>db.forecastScenario.findUniqueOrThrow({where:{kind:kind as 'CONSERVATIVE'|'BASE'|'OPTIMISTIC'}})));
    const common={projectId:'demo-project-5',expectedVersion:null};expect((await write('probabilities',{...common,scenarioId:conservative.id,probability:0.2})).status).toBe(200);expect((await write('probabilities',{...common,scenarioId:base.id,probability:0.5})).status).toBe(200);expect((await write('probabilities',{...common,scenarioId:optimistic.id,probability:0.8})).status).toBe(200);
    expect((await write('probabilities',{...common,scenarioId:base.id,probability:0.1,expectedVersion:1})).status).toBe(400);expect((await write('probabilities',{...common,scenarioId:base.id,probability:0.9,expectedVersion:1})).status).toBe(400);
    expect((await write('probabilities',{...common,scenarioId:base.id,probability:null,expectedVersion:1})).status).toBe(200);expect((await write('probabilities',{...common,scenarioId:base.id,probability:0.5,expectedVersion:1})).status).toBe(409);expect((await write('probabilities',{...common,scenarioId:base.id,probability:0.5,expectedVersion:2})).status).toBe(200);expect((await write('probabilities',{...common,scenarioId:conservative.id,probability:0,expectedVersion:1})).status).toBe(200);
  });
  it('protects probability writes from invalid status, concurrent edits and audit failure',async()=>{
    cookie.token=await signSession(adminId);const scenario=await db.forecastScenario.findUniqueOrThrow({where:{kind:'OPTIMISTIC'}});const data={projectId:'demo-project-5',scenarioId:scenario.id,probability:0.7,expectedVersion:1};
    expect((await write('probabilities',{...data,projectId:'demo-project-1',expectedVersion:null})).status).toBe(400);expect((await write('probabilities',{...data,probability:1.1})).status).toBe(400);
    const responses=await Promise.all([write('probabilities',data),write('probabilities',{...data,probability:0.75})]);expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
    await expect(saveProbability('missing-actor',{projectId:'demo-project-6',scenarioId:scenario.id,probability:0.9,expectedVersion:null})).rejects.toThrow();expect(await db.scenarioProjectProbability.count({where:{projectId:'demo-project-6'}})).toBe(0);
  });
  it('forecast seed is audited/idempotent and preserves edited demand/probability',async()=>{
    const before=await db.monthlyProjectDemand.findUniqueOrThrow({where:{projectId_month:{projectId,month:new Date('2026-11-01')}}});await seedForecast();const counts=[await db.monthlyProjectDemand.count(),await db.monthlySkillDemand.count(),await db.scenarioProjectProbability.count(),await db.auditLog.count()];await seedForecast();expect([await db.monthlyProjectDemand.count(),await db.monthlySkillDemand.count(),await db.scenarioProjectProbability.count(),await db.auditLog.count()]).toEqual(counts);expect(await db.monthlyProjectDemand.findUniqueOrThrow({where:{projectId_month:{projectId,month:new Date('2026-11-01')}}})).toEqual(before);
    const conservative=await db.forecastScenario.findUniqueOrThrow({where:{kind:'CONSERVATIVE'}});expect(Number((await db.scenarioProjectProbability.findUniqueOrThrow({where:{scenarioId_projectId:{scenarioId:conservative.id,projectId:'demo-project-5'}}})).probability)).toBe(0);
  });
  it('combines real capacity, demand, skills and scenarios; scoped supply and missing input remain explicit',async()=>{
    const scoped=await getForecastData('2026-12',1,{projectId:'demo-project-1'});const selected=scoped.outputs.find(s=>s.kind==='BASE')!.months[0];expect(selected.supply).toBe(7.8);expect(selected.confirmed).toBe(7);expect(selected.gap).toBe(0.8);expect(selected.skillGap).toBeGreaterThan(0);expect(scoped.distribution.projects).toEqual([{name:'Sakura Commerce',value:5.85}]);
    const global=await getForecastData('2026-12',1);const base=global.outputs.find(s=>s.kind==='BASE')!.months[0];expect(base.weightedPipeline).toBe(3.9);expect(base.missingCapacity).toContain('DX-NEW');expect(base.gap).toBeNull();
    cookie.token=await signSession(viewerId);const response=await forecastRead(new Request('http://localhost:3000/api/forecast/result?month=2026-10'),context('result'));expect(response.status).toBe(200);expect((await response.json()).months).toHaveLength(6);expect((await forecastRead(new Request('http://localhost:3000/api/forecast/result?month=2199-12'),context('result'))).status).toBe(400);
  });
});

describe('Phase 5 reporting/import and readiness integration',()=>{
  const context=(action:string)=>({params:Promise.resolve({action})});
  it('protects reports, import and audit with authentication/RBAC/Origin',async()=>{
    expect((await reportRead(new Request('http://localhost:3000/api/reports/summary?month=2026-10'),context('summary'))).status).toBe(401);
    cookie.token=await signSession(viewerId);
    expect((await reportRead(new Request('http://localhost:3000/api/reports/summary?month=2026-10'),context('summary'))).status).toBe(200);
    expect((await reportRead(new Request('http://localhost:3000/api/reports/audit'),context('audit'))).status).toBe(403);
    expect((await reportWrite(request('/api/reports/commit',{token:'x'}),context('commit'))).status).toBe(403);
    cookie.token=await signSession(managerId);
    expect((await reportWrite(request('/api/reports/commit',{token:'x'},'POST','https://evil.test'),context('commit'))).status).toBe(403);
  });
  it('keeps logout on the public origin when standalone normalizes request URL to localhost',async()=>{
    const r=await logout(new Request('http://localhost:3001/api/auth/logout',{method:'POST',headers:{host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001'}}));expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('/login');expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('rejects invalid/duplicate/missing input by row and performs no preview writes',async()=>{
    const before=await db.auditLog.count();const rows=[{...employee,code:'IMPORT-PREVIEW',email:'preview@example.test'},{...employee,code:'IMPORT-PREVIEW',email:'preview2@example.test'},{...employee,code:'IMPORT-BAD',level:7}];
    const preview=await previewImport(adminId,'employees',rows);expect(preview.token).toBeNull();expect(preview.errors.map(e=>e.row)).toEqual([3,4]);expect(await db.employee.count({where:{code:'IMPORT-PREVIEW'}})).toBe(0);expect(await db.auditLog.count()).toBe(before);
    const blank=await previewImport(adminId,'planned',[{employeeCode:'DX-001',projectCode:'DX-001',month:'2026-10',mm:null}]);expect(blank.errors).toHaveLength(1);
  });
  it('creates/updates employees atomically with audit and retries the same batch idempotently',async()=>{
    const preview=await previewImport(adminId,'employees',[{...employee,code:'IMPORT-001',email:'import1@example.test'},{...employee,code:'IMPORT-002',email:'import2@example.test'}]);expect(preview.errors).toEqual([]);
    const first=await commitImport(adminId,preview.token!);expect(first.rowCount).toBe(2);expect((await commitImport(adminId,preview.token!)).replayed).toBe(true);
    expect(await db.auditLog.count({where:{entity:'ImportBatch',entityId:first.id}})).toBe(1);
    const update=await previewImport(adminId,'employees',[{...employee,code:'IMPORT-001',email:'import1@example.test',level:5}]);expect(update.rows[0].operation).toBe('UPDATE');await commitImport(adminId,update.token!);expect((await db.employee.findUniqueOrThrow({where:{code:'IMPORT-001'}})).level).toBe(5);
  });
  it('rejects tampered tokens, another actor and stale dependency snapshots',async()=>{
    const preview=await previewImport(adminId,'employees',[{...employee,code:'IMPORT-001',email:'import1@example.test'}]);
    await expect(commitImport(managerId,preview.token!)).rejects.toMatchObject({status:403});await expect(commitImport(adminId,`${preview.token!.slice(0,-10)}aaaaaaaaaa`)).rejects.toMatchObject({status:400});
    await db.employee.update({where:{code:'IMPORT-001'},data:{level:6}});await expect(commitImport(adminId,preview.token!)).rejects.toMatchObject({status:409});
  });
  it('expires previews and rejects a concurrent import that would overwrite another batch',async()=>{
    const row={...employee,code:'IMPORT-001',email:'import1@example.test'};
    const first=await previewImport(adminId,'employees',[{...row,level:2}]);const second=await previewImport(adminId,'employees',[{...row,level:3}]);
    const expired=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(adminId).setIssuer('dx-import').setAudience('dx-import').setExpirationTime(Math.floor(Date.now()/1000)-60).sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    await expect(commitImport(adminId,expired)).rejects.toMatchObject({status:400});
    const results=await Promise.allSettled([commitImport(adminId,first.token!),commitImport(adminId,second.token!)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  });
  it('rejects duplicate email and rolls back data when audit cannot be written',async()=>{
    const rows=[{...employee,code:'IMPORT-ROLL1',email:'import-rollback@example.test'},{...employee,code:'IMPORT-ROLL2',email:'import-rollback@example.test'}];
    expect((await previewImport(adminId,'employees',rows)).token).toBeNull();
    const preview=await previewImport('missing-actor','employees',[rows[0],{...rows[1],email:'import-rollback2@example.test'}]);expect(preview.token).toBeTruthy();
    const count=await db.auditLog.count();await expect(commitImport('missing-actor',preview.token!)).rejects.toThrow();expect(await db.employee.count({where:{code:{startsWith:'IMPORT-ROLL'}}})).toBe(0);expect(await db.auditLog.count()).toBe(count);
  });
  it('rolls back the first row and its audit if a later row fails a database constraint',async()=>{
    const rows=[{...employee,code:'IMPORT-ROLL1',email:'later-rollback1@example.test'},{...employee,code:'IMPORT-ROLL2',email:'later-rollback2@example.test'}];
    const preview=await previewImport(adminId,'employees',rows);expect(preview.token).toBeTruthy();const count=await db.auditLog.count();
    await db.$executeRaw`ALTER TABLE "Employee" ADD CONSTRAINT "phase5_test_reject_second" CHECK ("code" <> 'IMPORT-ROLL2')`;
    try{await expect(commitImport(adminId,preview.token!)).rejects.toThrow();expect(await db.employee.count({where:{code:{in:rows.map(r=>r.code)}}})).toBe(0);expect(await db.auditLog.count()).toBe(count);}
    finally{await db.$executeRaw`ALTER TABLE "Employee" DROP CONSTRAINT "phase5_test_reject_second"`;}
  });
  it('imports projects with PM checks and preserves IDs/history on update',async()=>{
    const pm=await db.employee.findUniqueOrThrow({where:{id:'demo-employee-1'}});
    const row={code:'IMPORT-PROJECT',name:'Dự án Excel',customer:'Demo Customer',pmCode:pm.code,startDate:'2026-10-01',endDate:'2027-03-31',status:'ACTIVE',contractedMm:12,forecastMm:14};
    const preview=await previewImport(managerId,'projects',[row]);expect(preview.errors).toEqual([]);await commitImport(managerId,preview.token!);
    const p=await db.project.findUniqueOrThrow({where:{code:row.code}});expect(p.pmId).toBe(pm.id);
    const changed=await previewImport(managerId,'projects',[{...row,forecastMm:15}]);await commitImport(managerId,changed.token!);expect((await db.project.findUniqueOrThrow({where:{code:row.code}})).id).toBe(p.id);
    expect((await previewImport(managerId,'projects',[{...row,pmCode:'MISSING'}])).token).toBeNull();
    expect((await previewImport(managerId,'projects',[{...row,forecastMm:0.00001}])).token).toBeNull();
  });
  it('imports Planned and Actual separately through the same planning rules and audit',async()=>{
    const p=await db.project.findUniqueOrThrow({where:{code:'IMPORT-PROJECT'}});const e=await db.employee.findUniqueOrThrow({where:{code:'IMPORT-001'}});
    const row={employeeCode:e.code,projectCode:p.code,month:'2026-11',mm:1.2345};const planned=await previewImport(adminId,'planned',[row]);expect(planned.errors).toEqual([]);await commitImport(adminId,planned.token!);
    const actual=await previewImport(adminId,'actual',[{...row,mm:0}]);await commitImport(adminId,actual.token!);
    const a=await db.projectAssignment.findUniqueOrThrow({where:{employeeId_projectId:{employeeId:e.id,projectId:p.id}}});expect(Number((await db.monthlyAllocation.findUniqueOrThrow({where:{assignmentId_month:{assignmentId:a.id,month:new Date('2026-11-01')}}})).plannedMm)).toBe(1.2345);expect(Number((await db.monthlyActualEffort.findUniqueOrThrow({where:{assignmentId_month:{assignmentId:a.id,month:new Date('2026-11-01')}}})).actualMm)).toBe(0);
    const bad=await previewImport(adminId,'planned',[{...row,mm:-1},{...row,month:'2026-13'},{...row,mm:0.00001}]);expect(bad.errors).toHaveLength(3);
    const cancelled=await previewImport(adminId,'planned',[{...row,projectCode:(await db.project.findUniqueOrThrow({where:{id:'demo-project-8'}})).code}]);expect(cancelled.token).toBeNull();
  });
  it('handles XLSX preview and commit through HTTP handlers without accepting client row changes',async()=>{
    cookie.token=await signSession(adminId);const p=await db.project.findUniqueOrThrow({where:{code:'IMPORT-PROJECT'}});
    const buffer=await workbookBuffer([{name:'Data',columns:importColumns.actual,rows:[{employeeCode:'IMPORT-001',projectCode:p.code,month:'2026-12',mm:0.75}]}],[]);
    const response=await reportWrite(new Request('http://localhost:3000/api/reports/preview?kind=actual',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},body:new Uint8Array(buffer)}),context('preview'));expect(response.status).toBe(200);const data=await response.json();expect(data.token).toBeTruthy();
    const commit=await reportWrite(request('/api/reports/commit',{token:data.token,rows:[{mm:999}]}),context('commit'));expect(commit.status).toBe(200);
    expect((await reportWrite(request('/api/reports/preview?kind=actual',{}),context('preview'))).status).toBe(415);
  });
  it('exports typed/filterable workbooks and reconciles missing capacity and forecast results',async()=>{
    const result=await workforceReport({month:'2026-10',position:'PM',location:'ONSITE'});expect(result.summary).toHaveLength(6);expect(result.summary[0].headcount).toBe(1);
    const all=await workforceReport({month:'2026-10'});expect(all.summary[0].capacity).toBeNull();expect(all.summary[0].missingCapacity).toBeGreaterThan(0);
    const buffer=await exportReport('workforce',{month:'2026-10',position:'PM',location:'ONSITE'});const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as never);expect(book.getWorksheet('TongQuan')!.getCell('E2').value).toBe(result.summary[0].planned);
    const forecasts=new ExcelJS.Workbook();await forecasts.xlsx.load(await exportReport('forecast',{month:'2026-10'}) as never);expect(forecasts.getWorksheet('Forecast')!.rowCount).toBe(19);
    const employees=await parseImport(await exportReport('employees',{month:'2026-10',position:'PM'}),'employees');expect(employees.every(e=>e.position==='PM')).toBe(true);
    cookie.token=await signSession(viewerId);const response=await reportRead(new Request('http://localhost:3000/api/reports/export?kind=planned&month=2026-10'),context('export'));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('filters and paginates immutable audit with Vietnam date boundaries and redaction',async()=>{
    await db.auditLog.create({data:{actorId:adminId,entity:'AuditTest',entityId:'test',action:'TEST',before:{passwordHash:'hidden',mm:1},createdAt:new Date('2026-10-17T17:30:00Z')}});
    const data=await auditReport({entity:'AuditTest',actorId:adminId,from:'2026-10-18',to:'2026-10-18'});expect(data.total).toBe(1);expect(data.logs[0].before).toEqual({passwordHash:'[Đã ẩn]',mm:1});expect((await auditReport({entity:'AuditTest',to:'2026-10-17'})).total).toBe(0);
  });
  it('shares login limits in PostgreSQL and resets only after expiration',async()=>{
    const first=await loginAttempt('throttle@example.test');const attempts=await Promise.all(Array.from({length:10},()=>loginAttempt('throttle@example.test')));expect(attempts.filter(a=>a.allowed)).toHaveLength(9);
    await db.loginThrottle.update({where:{key:first.key},data:{expiresAt:new Date(Date.now()-1000)}});expect((await loginAttempt('throttle@example.test')).allowed).toBe(true);
  });
  it('revokes signed sessions using persisted session version and exposes minimal health',async()=>{
    cookie.token=await signSession(managerId);expect(await currentUser()).toBeTruthy();await db.user.update({where:{id:managerId},data:{sessionVersion:{increment:1}}});expect(await currentUser()).toBeNull();cookie.token=await signSession(managerId,1);expect(await currentUser()).toBeTruthy();
    expect((await health(new Request('http://localhost:3000/api/health'))).status).toBe(200);expect(await (await health(new Request('http://localhost:3000/api/health?check=ready'))).json()).toEqual({status:'ready'});
  });
});
