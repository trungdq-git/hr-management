import { SignJWT, jwtVerify } from 'jose';
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-')) throw new Error('SESSION_SECRET cần ít nhất 32 ký tự ngẫu nhiên');
  return new TextEncoder().encode(secret);
}
export async function signSession(id: string, version=0) {
  return new SignJWT({version}).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setIssuer('dx-itrms').setAudience('dx-itrms').setIssuedAt().setExpirationTime('8h').sign(key());
}
export async function verifySession(token: string) {
  return (await verifySessionDetails(token)).id;
}
export async function verifySessionDetails(token: string) {
  const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], issuer: 'dx-itrms', audience: 'dx-itrms' });
  return {id:payload.sub,version:typeof payload.version==='number'?payload.version:0};
}
