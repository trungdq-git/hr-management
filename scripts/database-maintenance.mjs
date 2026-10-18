import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve,join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir,stat } from 'node:fs/promises';
import pg from 'pg';

const [mode,fileArg]=process.argv.slice(2);
function connection(value){
  const url=new URL(value);if(!['postgresql:','postgres:'].includes(url.protocol))throw new Error('Cần PostgreSQL URL');
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1))};
  if(url.searchParams.has('sslmode'))env.PGSSLMODE=url.searchParams.get('sslmode');
  return {url,env};
}
function binary(name){
  const exe=process.platform==='win32'?`${name}.exe`:name;
  if(process.env.PG_BIN)return join(process.env.PG_BIN,exe);
  const local=resolve('node_modules/@embedded-postgres/windows-x64/native/bin',exe);
  return process.platform==='win32'&&existsSync(local)?local:exe;
}
async function command(name,args,env){await new Promise((resolve,reject)=>{
  const child=spawn(binary(name),args,{env,stdio:['ignore','ignore','pipe'],windowsHide:true});
  // Server/CLI diagnostics may contain credentials; don't echo untrusted stderr.
  child.stderr.resume();child.on('error',()=>reject(new Error(`Không chạy được ${name}; đặt PG_BIN tới PostgreSQL tools`)));child.on('exit',code=>code===0?resolve():reject(new Error(`${name} thất bại (exit ${code}); kiểm tra kết nối/quyền/phiên bản PostgreSQL`)));
});}
try{
  if(mode==='backup'){
    const file=resolve(fileArg||`.tools/backups/itrms-${new Date().toISOString().replaceAll(':','-')}.dump`);
    if(existsSync(file))throw new Error('File backup đã tồn tại; chọn tên mới');
    await mkdir(resolve(file,'..'),{recursive:true});
    await command('pg_dump',['--format=custom','--no-owner','--no-acl','--file',file],connection(process.env.DATABASE_URL).env);
    if((await stat(file)).size===0)throw new Error('Backup rỗng');console.log(`Backup: ${file}`);
  }else if(mode==='restore'){
    if(!fileArg||!process.env.RESTORE_DATABASE_URL||!process.argv.includes('--confirm-empty-target'))throw new Error('Cần file, RESTORE_DATABASE_URL cho database trống và --confirm-empty-target');
    const target=connection(process.env.RESTORE_DATABASE_URL);const source=connection(process.env.DATABASE_URL);
    if(target.url.host===source.url.host&&target.url.pathname===source.url.pathname)throw new Error('Không restore đè database nguồn');
    const client=new pg.Client({connectionString:process.env.RESTORE_DATABASE_URL});await client.connect();
    try{const {rows}=await client.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S')");if(rows[0].n>0)throw new Error('Database đích chưa trống; dừng để tránh ghi đè');}finally{await client.end();}
    await command('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname',target.env.PGDATABASE,resolve(fileArg)],target.env);console.log('Restore thành công vào database trống; tiếp tục đối chiếu số liệu và migration.');
  }else throw new Error('Dùng backup [file] hoặc restore file --confirm-empty-target');
}catch(error){console.error(error instanceof Error?error.message:'Database maintenance thất bại');process.exitCode=1;}
