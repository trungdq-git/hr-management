import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/origin';
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ' }, { status: 403 });
  // Relative redirect preserves the browser's public origin behind standalone/proxies.
  const response = new NextResponse(null, {status:303,headers:{Location:'/login'}});
  response.cookies.set('dx_session', '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return response;
}
