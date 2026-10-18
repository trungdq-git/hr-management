import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) throw new Error('.env đã tồn tại; không ghi đè cấu hình.');
const secret=randomBytes(48).toString('base64url');
writeFileSync('.env', `DATABASE_URL="postgresql://itrms:itrms_local@127.0.0.1:5432/itrms"\nSESSION_SECRET="${secret}"\nSEED_DEMO_PASSWORD="DxService-Demo-2026!"\n`, { mode: 0o600 });
console.log('Đã tạo .env local với session secret ngẫu nhiên. Chỉ dùng cấu hình demo trên localhost.');
