import { NextResponse } from 'next/server';
import { authorizeWrite } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { saveEmployee } from '@/lib/services';
export async function POST(request: Request) {
  try { const user = await authorizeWrite(request); return NextResponse.json(await saveEmployee(user.id, await request.json()), { status: 201 }); }
  catch (e) { return errorResponse(e); }
}
