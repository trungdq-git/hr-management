'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { Button } from './ui/button';
export function LoginForm() {
  const [error, setError] = useState(''); const [pending, setPending] = useState(false); const router = useRouter();
  return <form className="space-y-5" onSubmit={async e => { e.preventDefault(); setError(''); setPending(true); const data = new FormData(e.currentTarget); try { const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) }); const body = await r.json(); if (!r.ok) throw new Error(body.error); router.push('/'); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Không thể đăng nhập'); } finally { setPending(false); } }}>
    <label className="field">Email<input name="email" type="email" placeholder="admin@example.test" required autoComplete="username" /></label><label className="field">Mật khẩu<input name="password" type="password" required autoComplete="current-password" placeholder="Nhập mật khẩu" /></label>{error && <p role="alert" className="text-xs text-red-600">{error}</p>}<Button disabled={pending} className="w-full" type="submit">{pending ? <LoaderCircle className="animate-spin" size={16} /> : <>Đăng nhập <ArrowRight size={16} /></>}</Button>
  </form>;
}
