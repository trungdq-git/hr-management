'use client';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <div role="alert" className="panel mx-auto my-16 max-w-xl p-10 text-center"><AlertTriangle className="mx-auto text-orange-500" size={36} /><h1 className="mt-5 text-xl font-bold">Chưa thể tải dữ liệu</h1><p className="my-4 text-sm leading-6 text-muted-foreground">Vui lòng kiểm tra kết nối PostgreSQL, DATABASE_URL và chạy migration/seed theo README.</p><Button onClick={reset}>Thử lại</Button></div>; }
