import 'dotenv/config';
import { randomBytes } from 'node:crypto';
export function productionIssues(env){
  const issues=[];
  if(env.NODE_ENV!=='production')issues.push('NODE_ENV phải là production');
  let url;try{url=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error();}catch{issues.push('DATABASE_URL PostgreSQL không hợp lệ');}
  if(url){
    if(['postgres','itrms','itrms_test'].includes(decodeURIComponent(url.username)))issues.push('Dùng runtime DB role riêng với quyền tối thiểu');
    if(['itrms_local','test_local_only','postgres'].includes(decodeURIComponent(url.password))||!url.password)issues.push('Không dùng mật khẩu DB demo/trống');
    if(!['localhost','127.0.0.1','::1'].includes(url.hostname)&&!['verify-full','verify-ca'].includes(url.searchParams.get('sslmode')))issues.push('Database ngoài loopback cần sslmode=verify-full hoặc verify-ca và CA tin cậy');
  }
  if(!env.SESSION_SECRET||env.SESSION_SECRET.length<48||/replace-|demo|integration-test/i.test(env.SESSION_SECRET))issues.push('SESSION_SECRET cần ít nhất 48 ký tự ngẫu nhiên riêng production');
  try{if(new URL(env.APP_ORIGIN).protocol!=='https:')throw new Error();}catch{issues.push('APP_ORIGIN cần URL HTTPS công khai');}
  if(env.SEED_DEMO_PASSWORD)issues.push('Loại SEED_DEMO_PASSWORD khỏi môi trường production');
  return issues;
}
if(process.argv[1]?.endsWith('check-production.mjs')){
  const issues=productionIssues(process.env);
  if(issues.length){issues.forEach(i=>console.error(`FAIL: ${i}`));process.exitCode=1;}
  else console.log('Cấu hình cơ bản đạt. Vẫn cần health, restore drill, DB permissions, TLS, giám sát và browser E2E theo runbook.');
}
// Avoid embedding a real secret in example configuration/tests.
export const exampleSecret=()=>randomBytes(48).toString('base64url');
