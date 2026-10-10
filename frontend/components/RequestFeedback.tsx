"use client";

import { useEffect, useState } from 'react';

type Notice = { message: string; kind: 'error' | 'success' | 'info' };

export default function RequestFeedback() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setNotice((event as CustomEvent<Notice>).detail);
    window.addEventListener('poms-notice', receive);
    return () => window.removeEventListener('poms-notice', receive);
  }, []);
  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  const colors = notice.kind === 'error' ? 'border-red-300 bg-red-50 text-red-800'
    : notice.kind === 'success' ? 'border-green-300 bg-green-50 text-green-800'
    : 'border-gray-300 bg-white text-gray-800';
  return (
    <div className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[100] rounded-lg border p-4 shadow-lg flex items-start gap-4 ${colors}`}>
      <p role={notice.kind === 'error' ? 'alert' : 'status'} className="text-sm flex-1">{notice.message}</p>
      <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification" className="px-1 font-bold">×</button>
    </div>
  );
}
