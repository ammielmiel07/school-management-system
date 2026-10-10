"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clearSession } from '@/lib/api';

type NavGroup = { title: string; links: { href: string; label: string }[] };

export default function PortalLayout({ children, roleId, title, groups }: {
  children: React.ReactNode; roleId: string; title: string; groups: NavGroup[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role_id');
    let valid = false;
    try {
      const encoded = token?.split('.')[1];
      const payload = encoded ? JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))) : null;
      valid = role === roleId && String(payload?.role_id) === roleId && !payload?.pending_reset && payload?.exp * 1000 > Date.now();
    } catch { /* Invalid stored sessions are cleared below. */ }
    if (!valid) {
      clearSession();
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [roleId, router]);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
      if (event.key === 'Tab' && window.innerWidth < 768) {
        const focusable = sidebar.current?.querySelectorAll<HTMLElement>('a, button');
        const first = focusable?.[0];
        const last = focusable?.[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [open]);
  if (!ready) return <p role="status" className="p-4 sm:p-8 text-center text-gray-600">Checking your session…</p>;
  return (
    <div className="flex h-dvh bg-gray-100 font-sans text-gray-800">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] bg-white p-3 rounded">Skip to content</a>
      {open && <button type="button" aria-label="Close navigation" className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => { setOpen(false); menuButton.current?.focus(); }} />}
      <aside ref={sidebar} id="portal-navigation" className={`portal-sidebar fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-[#3e0f0f] flex flex-col shadow-xl transition-transform md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="relative flex flex-col items-center p-6 border-b border-red-900">
          <button ref={closeButton} type="button" aria-label="Close navigation" onClick={() => { setOpen(false); menuButton.current?.focus(); }} className="absolute top-3 right-3 p-2 text-white md:hidden">×</button>
          <div className="w-28 h-28 bg-white rounded-full overflow-hidden mb-4 shadow-lg">
            <Image src="/Prudencia-Logo.png" alt="Prudencia school logo" width={112} height={112} className="object-contain p-1" />
          </div>
          <h2 className="font-bold text-white text-xl tracking-wider uppercase text-center">{title}</h2>
        </div>
        <nav aria-label={`${title} navigation`} className="flex-1 overflow-y-auto px-4 py-6 space-y-6 text-gray-300">
          {groups.map(group => <div key={group.title}>
            <h3 className="text-xs uppercase font-bold text-red-300 mb-3 tracking-wider">{group.title}</h3>
            <ul className="space-y-1">{group.links.map(link => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return <li key={link.href}><Link href={link.href} aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)} className={`block px-3 py-2 rounded-md font-medium transition-colors ${active ? 'bg-red-900 text-white' : 'hover:bg-red-900 hover:text-white'}`}>{link.label}</Link></li>;
            })}</ul>
          </div>)}
        </nav>
        <div className="p-4 border-t border-red-900"><button type="button" onClick={() => { clearSession(); router.replace('/login'); }} className="w-full text-left px-3 py-2 text-gray-300 rounded-md hover:bg-red-900 hover:text-white">Log Out</button></div>
      </aside>
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <header className="bg-[#3e0f0f] text-white p-4 flex items-center justify-between md:hidden shrink-0">
          <span className="font-bold uppercase">POMS {title}</span>
          <button ref={menuButton} type="button" aria-label="Open navigation" aria-expanded={open} aria-controls="portal-navigation" onClick={() => setOpen(true)} className="p-2">☰</button>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
