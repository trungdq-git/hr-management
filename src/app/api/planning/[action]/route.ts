import { NextResponse } from 'next/server';
import { authorizeWrite, currentUser, HttpError } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { createCalendar, saveCalendarMonth, saveCapacitySettings, saveAbsence, saveEffort } from '@/lib/planning-service';
import { planningHistory } from '@/lib/planning-data';

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const user = await authorizeWrite(request);
    const { action } = await context.params;
    const handler = { calendars: createCalendar, 'calendar-month': saveCalendarMonth, settings: saveCapacitySettings, absences: saveAbsence, effort: saveEffort }[action];
    if (!handler) throw new HttpError(404, 'Không tìm thấy thao tác');
    return NextResponse.json(await handler(user.id, await request.json()));
  } catch (error) { return errorResponse(error); }
}
export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    if (!await currentUser()) throw new HttpError(401, 'Vui lòng đăng nhập');
    const { action } = await context.params;
    if (action !== 'history') throw new HttpError(404, 'Không tìm thấy thao tác');
    const query = new URL(request.url).searchParams;
    return NextResponse.json(await planningHistory({ employeeId: query.get('employeeId') ?? undefined, projectId: query.get('projectId') ?? undefined, month: query.get('month') ?? undefined }));
  } catch (error) { return errorResponse(error); }
}
