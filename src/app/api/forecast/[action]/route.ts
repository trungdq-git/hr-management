import { NextResponse } from 'next/server';
import { authorizeWrite, currentUser, HttpError } from '@/lib/auth';
import { errorResponse } from '@/lib/http';
import { initializeScenarios, saveDemand, saveProbability } from '@/lib/forecast-service';
import { getForecastData } from '@/lib/forecast-data';
import { MONTH_PATTERN } from '@/lib/planning-dates';
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const user = await authorizeWrite(request); const { action } = await context.params;
    if (action === 'scenarios') return NextResponse.json(await initializeScenarios(user.id));
    const handler = { demands: saveDemand, probabilities: saveProbability }[action];
    if (!handler) throw new HttpError(404, 'Không tìm thấy thao tác');
    return NextResponse.json(await handler(user.id, await request.json()));
  } catch(error) { return errorResponse(error); }
}
export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    if (!await currentUser()) throw new HttpError(401, 'Vui lòng đăng nhập');
    if ((await context.params).action !== 'result') throw new HttpError(404, 'Không tìm thấy thao tác');
    const month = new URL(request.url).searchParams.get('month') ?? '';
    if (!MONTH_PATTERN.test(month) || month > '2199-07') throw new HttpError(400, 'Tháng bắt đầu YYYY-MM, từ 1900-01 đến 2199-07');
    return NextResponse.json(await getForecastData(month));
  } catch(error) { return errorResponse(error); }
}
