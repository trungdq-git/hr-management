import { createHash } from 'node:crypto';
import { db } from './db';
export async function loginAttempt(email:string){
  const key=createHash('sha256').update(email.toLowerCase()).digest('hex');
  const rows=await db.$queryRaw<{attempts:number;expiresAt:Date}[]>`
    INSERT INTO "LoginThrottle" ("key","attempts","expiresAt") VALUES (${key},1, NOW()+INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts"=CASE WHEN "LoginThrottle"."expiresAt"<=NOW() THEN 1 ELSE "LoginThrottle"."attempts"+1 END,
      "expiresAt"=CASE WHEN "LoginThrottle"."expiresAt"<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE "LoginThrottle"."expiresAt" END
    RETURNING "attempts","expiresAt"`;
  return {key,allowed:rows[0].attempts<=10};
}
