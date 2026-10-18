import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { verifySessionDetails } from './session';
import { isSameOrigin } from './origin';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function currentUser() {
  const token = (await cookies()).get('dx_session')?.value;
  if (!token) return null;
  let session: Awaited<ReturnType<typeof verifySessionDetails>>;
  try { session = await verifySessionDetails(token); } catch { return null; }
  if (!session.id) return null;
  return db.user.findFirst({ where: { id:session.id, active: true, sessionVersion:session.version }, select: { id: true, name: true, email: true, role: true } });
}
export async function requireUser() { const user = await currentUser(); if (!user) redirect('/login'); return user; }
export async function authorizeWrite(request: Request) {
  if (!isSameOrigin(request)) throw new HttpError(403, 'Nguồn yêu cầu không hợp lệ');
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Vui lòng đăng nhập');
  if (user.role === 'VIEWER') throw new HttpError(403, 'Bạn không có quyền thay đổi dữ liệu');
  return user;
}
