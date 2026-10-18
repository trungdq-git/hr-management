'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, Users, FolderKanban, Grid3X3, CalendarRange, ChartNoAxesCombined, FileChartColumn, Settings2, ChevronDown, Menu, X, LogOut, Layers, ArrowUpRight, ShieldCheck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { roles } from '@/lib/labels';
const nav = [
  { href: '/', label: 'Tổng quan điều hành', icon: LayoutDashboard },
  { href: '/employees', label: 'Danh sách nhân viên', icon: Users },
  { href: '/projects', label: 'Danh mục dự án', icon: FolderKanban },
  { href: '/skills', label: 'Năng lực & kỹ năng', icon: Grid3X3 },
  { href: '/allocations', label: 'Phân bổ nguồn lực', icon: Layers },
  { href: '/capacity', label: 'Kế hoạch Capacity', icon: CalendarRange },
  { href: '/forecast', label: 'Dự báo nguồn lực', icon: ChartNoAxesCombined },
  { href: '/reports', label: 'Báo cáo & phân tích', icon: FileChartColumn },
  { href: '/audit', label: 'Lịch sử thay đổi', icon: ShieldCheck },
];
export function Shell({ children, user }: { children: React.ReactNode; user: { name: string; role: keyof typeof roles } }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const title = [...nav, { href: '/settings', label: 'Cài đặt hệ thống' }].find(n => n.href === '/' ? path === '/' : path.startsWith(n.href))?.label ?? 'Chi tiết nhân viên';
  return <div className="min-h-screen">
    {open && <button aria-label="Đóng menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" />}
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col bg-[#102a4b] text-white transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
      <Link href="/" className="flex h-[88px] items-center gap-3 border-b border-white/8 px-6"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-xl font-black italic">dx<span className="text-[10px]">.</span></span><span><strong className="block text-[19px] tracking-tight">DX Service</strong><span className="text-[9px] tracking-[.2em] text-slate-400">RESOURCE MANAGEMENT</span></span></Link>
      <div className="px-6 pt-7 pb-3 text-[9px] font-semibold tracking-[.15em] text-[#6f8ba9]">KHÔNG GIAN LÀM VIỆC</div>
      <nav className="space-y-1 px-3">{nav.filter(n=>n.href!=="/audit"||user.role!=="VIEWER").map(n => { const active = n.href === '/' ? path === '/' : path.startsWith(n.href); return <Link onClick={() => setOpen(false)} key={n.href} href={n.href} className={cn('flex items-center gap-3 rounded-lg px-3 py-3 text-[12px] transition-colors', active ? 'bg-[#244363] text-white' : 'text-[#a9b9cb] hover:bg-white/5 hover:text-white')}><n.icon size={17} className={active ? 'text-orange-400' : ''} /><span className="flex-1">{n.label}</span>{active ? <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> : null}</Link>; })}</nav>
      <div className="mt-auto p-4"><div className="mb-5 rounded-xl border border-white/10 bg-white/[.03] p-4"><span className="mb-2 flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={15} className="text-orange-400" /> Môi trường demo</span><p className="text-[10px] leading-5 text-[#8ea5be]">Dữ liệu giả lập. Sẵn sàng xây dựng đội ngũ cho tương lai.</p><span className="mt-3 flex items-center gap-1 text-[10px] text-orange-300">Reporting · Phase 5 <ArrowUpRight size={12} /></span></div><Link href="/settings" className="flex items-center gap-3 px-2 text-xs text-[#a9b9cb]"><Settings2 size={17} /> Cài đặt hệ thống</Link></div>
      <div className="border-t border-white/10 px-6 py-4 text-[9px] text-[#6683a1]">DX SERVICE © 2026 · IT-RMS v0.5</div>
    </aside>
    <div className="lg:pl-[236px]"><header className="flex h-[72px] items-center justify-between border-b border-border bg-white px-5 lg:px-8"><div className="flex items-center gap-3"><button onClick={() => setOpen(!open)} aria-label="Mở menu" className="lg:hidden">{open ? <X size={20} /> : <Menu size={20} />}</button><span className="text-xs text-slate-400">Không gian làm việc <span className="mx-3 text-slate-300">/</span><span className="font-medium text-slate-600">{title}</span></span></div><div className="flex items-center gap-5"><Link href="/employees" aria-label="Tìm nhân viên" className="text-slate-400"><Search size={18} /></Link><span className="hidden h-6 w-px bg-border sm:block" /><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf2f8] text-xs font-bold text-primary">{user.name.split(' ').slice(-2).map(s => s[0]).join('')}</span><span className="hidden sm:block"><strong className="block text-[11px]">{user.name}</strong><span className="text-[9px] text-muted-foreground">{roles[user.role]}</span></span><ChevronDown size={12} className="text-slate-400" /></div><form action="/api/auth/logout" method="post"><button title="Đăng xuất" aria-label="Đăng xuất" className="text-slate-400 hover:text-orange-500"><LogOut size={16} /></button></form></div></header><main className="mx-auto max-w-[1640px] p-5 lg:p-8">{children}</main><footer className="flex justify-between px-8 pb-5 text-[10px] text-slate-400"><span>DX Service · IT Resource Management System</span><span>Dữ liệu demo · Phase 5 — Reporting</span></footer></div>
  </div>;
}
