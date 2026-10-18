import Link from 'next/link';
export default function NotFound() { return <main className="p-16 text-center"><p className="eyebrow">404</p><h1 className="my-4 text-2xl font-bold">Không tìm thấy nội dung</h1><Link href="/" className="text-orange-600 underline">Về trang tổng quan</Link></main>; }
