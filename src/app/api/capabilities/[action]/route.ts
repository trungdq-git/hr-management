import { NextResponse } from 'next/server';
import { authorizeWrite, currentUser, HttpError } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { saveRating, saveRequirement, saveSkill } from '@/lib/capability-service';
import { searchResources } from '@/lib/capability-data';
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const user = await authorizeWrite(request); const { action } = await context.params;
    const handler = { skills: saveSkill, ratings: saveRating, requirements: saveRequirement }[action];
    if (!handler) throw new HttpError(404, 'Không tìm thấy thao tác');
    return NextResponse.json(await handler(user.id, await request.json()));
  } catch (error) { return errorResponse(error); }
}
export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    if (!await currentUser()) throw new HttpError(401, 'Vui lòng đăng nhập');
    if ((await context.params).action !== 'search') throw new HttpError(404, 'Không tìm thấy thao tác');
    const filters = new URL(request.url).searchParams.get('filters');
    if (!filters || filters.length > 12000) throw new HttpError(400, 'Thiếu hoặc vượt giới hạn bộ lọc');
    return NextResponse.json(await searchResources(JSON.parse(filters)));
  } catch (error) { return errorResponse(error); }
}
