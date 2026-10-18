import { NextResponse } from 'next/server';
import { authorizeWrite } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { saveProject } from '@/lib/services';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await authorizeWrite(request); const { id } = await context.params; return NextResponse.json(await saveProject(user.id, await request.json(), id)); }
  catch (e) { return errorResponse(e); }
}
