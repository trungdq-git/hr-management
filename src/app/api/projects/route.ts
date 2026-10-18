import { NextResponse } from 'next/server';
import { authorizeWrite } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { saveProject } from '@/lib/services';
export async function POST(request: Request) {
  try { const user = await authorizeWrite(request); return NextResponse.json(await saveProject(user.id, await request.json()), { status: 201 }); }
  catch (e) { return errorResponse(e); }
}
