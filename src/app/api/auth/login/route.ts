import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { signSession } from '@/lib/session';
import { z } from 'zod';
import { isSameOrigin } from '@/lib/origin';
import { loginAttempt } from '@/lib/login-throttle';
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ' }, { status: 403 });
  const parsed = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Email hoặc mật khẩu không hợp lệ' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  try {
    const attempt=await loginAttempt(email);
    if(!attempt.allowed)return NextResponse.json({error:'Quá nhiều lần đăng nhập. Thử lại sau 15 phút.'},{status:429,headers:{'Retry-After':'900'}});
    const user = await db.user.findUnique({ where: { email } });
    // Constant bcrypt work for unknown accounts.
    const valid = await compare(parsed.data.password, user?.passwordHash ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
    if (!user?.active || !valid) return NextResponse.json({ error: 'Email hoặc mật khẩu không chính xác' }, { status: 401 });
    const token = await signSession(user.id,user.sessionVersion);
    await db.auditLog.create({ data: { actorId: user.id, entity: 'User', entityId: user.id, action: 'LOGIN' } });
    await db.loginThrottle.deleteMany({where:{key:attempt.key}});
    const response = NextResponse.json({ ok: true });
    response.cookies.set('dx_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600, path: '/' });
    return response;
  } catch { return NextResponse.json({ error: 'Không thể kết nối hệ thống. Kiểm tra cấu hình cơ sở dữ liệu.' }, { status: 503 }); }
}
