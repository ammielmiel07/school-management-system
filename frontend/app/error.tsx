"use client";

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error('Page failed to render:', error); }, [error]);
  return <div className="max-w-lg mx-auto p-8 my-12 bg-white rounded-lg shadow-sm border border-gray-200">
    <h1 className="text-2xl font-bold text-[#5D1919]">We couldn’t load this page</h1>
    <p className="text-gray-600 mt-3">Please try again. If the problem continues, contact the school administrator.</p>
    <div className="flex gap-4 mt-6"><button type="button" onClick={unstable_retry} className="bg-[#5D1919] text-white px-4 py-2 rounded">Try again</button><Link href="/" className="px-4 py-2 underline">Return home</Link></div>
  </div>;
}
