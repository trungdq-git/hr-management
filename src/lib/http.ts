import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './auth';
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON không hợp lệ' }, { status: 400 });
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'P2002') return NextResponse.json({ error: 'Mã hoặc email đã tồn tại' }, { status: 409 });
  if (code === 'P2025') return NextResponse.json({ error: 'Không tìm thấy bản ghi' }, { status: 404 });
  if (code === 'P2003') return NextResponse.json({ error: 'Dữ liệu liên kết không hợp lệ' }, { status: 400 });
  if (code === 'P2034') return NextResponse.json({ error: 'Dữ liệu đang được thay đổi đồng thời. Vui lòng tải lại hoặc xem trước lại.' }, { status: 409 });
  console.error('IT-RMS server error', error instanceof Error ? error.name : 'Unknown');
  return NextResponse.json({ error: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' }, { status: 500 });
}
