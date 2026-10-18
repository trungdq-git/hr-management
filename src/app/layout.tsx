import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'DX Service | IT Resource Management', description: 'Hệ thống quản lý nguồn lực IT — DX Service' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body>{children}</body></html>; }
