import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://itrms:itrms_local@127.0.0.1:5432/itrms');
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('db:local chỉ hỗ trợ localhost');
const probe=new Client({connectionString:url.toString(),connectionTimeoutMillis:2000});
try {
  await probe.connect();await probe.end();
  console.log(`PostgreSQL đã chạy tại ${url.hostname}:${url.port||5432}. Tái sử dụng dịch vụ hiện có; không khởi động thêm process.`);
  process.exit(0);
} catch(error) {
  await probe.end().catch(()=>{});
  const code=typeof error==='object'&&error!==null&&'code' in error?error.code:undefined;
  if(code!=='ECONNREFUSED'&&code!=='3D000')throw new Error('Không thể kết nối PostgreSQL hiện có. Kiểm tra DATABASE_URL và quyền truy cập.');
}
const databaseDir=resolve('.tools/local-postgres');
const postgres=new EmbeddedPostgres({databaseDir,user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),port:Number(url.port||5432),persistent:true,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:message=>console.error(String(message))});
if(!existsSync(resolve(databaseDir,'PG_VERSION')))await postgres.initialise();
await postgres.start();
const name=url.pathname.slice(1);
const client=postgres.getPgClient();await client.connect();
const found=await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);await client.end();
if(!found.rowCount)await postgres.createDatabase(name);
console.log(`PostgreSQL local sẵn sàng tại ${url.hostname}:${url.port||5432}/${name}. Ctrl+C để dừng; dữ liệu giữ nguyên.`);
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await postgres.stop();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
setInterval(()=>{},60000);
