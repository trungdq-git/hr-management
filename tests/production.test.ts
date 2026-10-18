import {describe,it,expect} from 'vitest';
import { productionIssues,exampleSecret } from '../scripts/check-production.mjs';
describe('Production preflight',()=>{
  it('rejects demo credentials, missing TLS origin and weak secrets',()=>{const issues=productionIssues({NODE_ENV:'production',DATABASE_URL:'postgresql://itrms:itrms_local@localhost/itrms',SESSION_SECRET:'demo',SEED_DEMO_PASSWORD:'demo'});expect(issues.length).toBeGreaterThanOrEqual(4);});
  it('accepts minimum configuration and requires verified remote DB TLS',()=>{const env={NODE_ENV:'production',DATABASE_URL:'postgresql://itrms_runtime:strong-production-password@db.example.test/itrms?sslmode=verify-full',SESSION_SECRET:exampleSecret(),APP_ORIGIN:'https://itrms.example.test'};expect(productionIssues(env)).toEqual([]);expect(productionIssues({...env,DATABASE_URL:env.DATABASE_URL.replace('verify-full','require')})).toContain('Database ngoài loopback cần sslmode=verify-full hoặc verify-ca và CA tin cậy');});
});
