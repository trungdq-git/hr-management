import 'dotenv/config';
import { cp,access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
const {values}=parseArgs({options:{port:{type:'string',short:'p'}}});
const port=values.port||process.env.PORT||'3000';
if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('Port không hợp lệ');
const server=resolve('.next/standalone/server.js');
try{await access(server);}catch{throw new Error('Chạy npm run build trước npm start');}
await cp(resolve('.next/static'),resolve('.next/standalone/.next/static'),{recursive:true});
const child=spawn(process.execPath,[server],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:port},stdio:'inherit',windowsHide:true});
process.on('SIGINT',()=>child.kill('SIGTERM'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
child.on('error',()=>{console.error('Không khởi động được standalone server');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??0;});
