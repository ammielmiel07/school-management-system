import Link from 'next/link';

export default function NotFound() {
  return <div className="p-4 sm:p-8 text-center my-12"><h1 className="text-2xl font-bold text-[#5D1919]">Page not found</h1><p className="text-gray-600 mt-3">The page may have moved or the address may be incorrect.</p><Link href="/" className="inline-block mt-6 text-[#5D1919] underline">Return home</Link></div>;
}
