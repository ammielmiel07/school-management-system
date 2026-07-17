"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const roleId = localStorage.getItem("role_id");

    // Role ID 2 is typically Faculty/Teacher
    if (!token || roleId !== "2") {
      router.push("/login");
      return;
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-[#3e0f0f] text-white flex flex-col">
        <div className="p-6 text-center border-b border-[#5D1919]">
          <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center mb-4">
            <img 
                src="/Prudencia-Logo.png" 
                alt="School Logo" 
                className="w-full h-full object-contain p-1" 
            />
          </div>
          <h2 className="font-bold text-lg tracking-wider uppercase">Faculty Portal</h2>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <div className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-2 mt-4">Menu</div>
          
          <Link 
            href="/faculty/dashboard" 
            className={`block px-4 py-2 rounded transition ${
              pathname === '/faculty/dashboard' 
                ? 'bg-[#5D1919] text-white font-bold' 
                : 'text-red-100 hover:bg-[#5D1919] hover:text-white'
            }`}
          >
            Dashboard
          </Link>
          <Link 
            href="/faculty/my-classes" 
            className={`block px-4 py-2 rounded transition ${
              pathname === '/faculty/my-classes' 
                ? 'bg-[#5D1919] text-white font-bold' 
                : 'text-red-100 hover:bg-[#5D1919] hover:text-white'
            }`}
          >
            My Classes
          </Link>
          <Link 
            href="/faculty/advisory" 
            className={`block px-4 py-2 rounded transition ${
              pathname === '/faculty/advisory' 
                ? 'bg-[#5D1919] text-white font-bold' 
                : 'text-red-100 hover:bg-[#5D1919] hover:text-white'
            }`}
          >
            Advisory Class
          </Link>
        </nav>

        <div className="p-4 border-t border-[#5D1919]">
          <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-red-100 hover:text-white hover:bg-[#5D1919] rounded transition">
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}