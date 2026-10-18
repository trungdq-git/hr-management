import 'dotenv/config';
import assert from 'node:assert/strict';
const origin=process.env.SMOKE_ORIGIN??'http://127.0.0.1:3000';
const loginPage=await fetch(`${origin}/login`);assert.equal(loginPage.status,200);assert.match(await loginPage.text(),/Đăng nhập IT-RMS/);
assert.equal(loginPage.headers.get('x-content-type-options'),'nosniff');assert.equal(loginPage.headers.get('x-frame-options'),'DENY');
const ready=await fetch(`${origin}/api/health?check=ready`);assert.equal(ready.status,200);assert.deepEqual(await ready.json(),{status:'ready'});
const unauth=await fetch(origin,{redirect:'manual'});assert.equal(unauth.status,307);assert.equal(new URL(unauth.headers.get('location'),origin).pathname,'/login');
const login=await fetch(`${origin}/api/auth/login`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'admin@example.test',password:process.env.SEED_DEMO_PASSWORD})});assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
for(const [path,content] of [['/','Tổng quan điều hành'],['/employees','Đội ngũ của bạn'],['/employees/demo-employee-1','Thông tin nhân sự'],['/projects','Danh mục dự án'],['/projects/demo-project-1','Yêu cầu kỹ năng dự án'],['/skills?month=2026-10','Skill Matrix'],['/skills?month=2026-10&tab=catalog','Danh mục kỹ năng'],['/skills?month=2026-10&tab=search&project=demo-project-1','Tìm nhân sự theo năng lực'],['/capacity?month=2026-10','Lịch làm việc'],['/capacity?month=2026-10&tab=people','Capacity theo nhân viên'],['/capacity?month=2026-10&tab=absences','Ngày nghỉ đã ghi nhận'],['/allocations?month=2026-10','Ma trận phân bổ nguồn lực'],['/forecast','Dự báo nguồn lực'],['/settings','Phiên hiện tại']]){
  const response=await fetch(origin+path,{headers:{cookie}});assert.equal(response.status,200,path);assert.ok((await response.text()).includes(content),`${path}: missing content`);console.log(`PASS ${path} (HTTP 200 + expected content)`);
}
const history=await fetch(`${origin}/api/planning/history?employeeId=demo-employee-8&month=2026-10`,{headers:{cookie}});assert.equal(history.status,200);assert.ok(Array.isArray(await history.json()));
for(const [path,content] of [['/reports?month=2026-10','Tổng hợp 6 tháng'],['/audit?entity=Employee','Lịch sử thay đổi']]){
  const response=await fetch(origin+path,{headers:{cookie}});assert.equal(response.status,200,path);assert.ok((await response.text()).includes(content));console.log(`PASS ${path}`);
}
const summary=await fetch(`${origin}/api/reports/summary?month=2026-10`,{headers:{cookie}});assert.equal(summary.status,200);assert.equal((await summary.json()).summary.length,6);
for(const action of ['template?kind=planned','export?kind=workforce&month=2026-10','export?kind=forecast&month=2026-10']){
  const response=await fetch(`${origin}/api/reports/${action}`,{headers:{cookie}});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/spreadsheetml/);assert.match(response.headers.get('cache-control'),/no-store/);const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
}
const filters={month:'2026-10',query:'',position:'',location:'',minLevel:1,maxLevel:6,jlpt:'ANY',mode:'ALL',skills:[],availability:'AVAILABLE',minAvailableMm:0.1,projectId:'demo-project-1'};
const search=await fetch(`${origin}/api/capabilities/search?${new URLSearchParams({filters:JSON.stringify(filters)})}`,{headers:{cookie}});assert.equal(search.status,200);const result=await search.json();assert.ok(Array.isArray(result.matches));assert.equal(result.month,'2026-10');
const forecast=await fetch(`${origin}/api/forecast/result?month=2026-10`,{headers:{cookie}});assert.equal(forecast.status,200);const projection=await forecast.json();assert.equal(projection.months.length,6);assert.ok(Array.isArray(projection.outputs));assert.equal(projection.outputs.length,3);
for(const scenario of projection.outputs){assert.equal(scenario.months.length,6);for(const row of scenario.months){if(row.supply!==null&&row.expectedDemand!==null)assert.equal(Math.round(row.gap*10000),Math.round(row.supply*10000)-Math.round(row.expectedDemand*10000));}}
const logout=await fetch(`${origin}/api/auth/logout`,{method:'POST',headers:{origin,cookie},redirect:'manual'});assert.equal(logout.status,303);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
assert.equal(new URL(logout.headers.get('location'),origin).origin,new URL(origin).origin);assert.equal(new URL(logout.headers.get('location'),origin).pathname,'/login');
console.log('PASS login, protected redirect, authenticated pages, logout.');
