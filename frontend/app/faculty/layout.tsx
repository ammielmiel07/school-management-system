"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("Teacher");

  useEffect(() => {
    // Quick security check: Ensure they are logged in and actually a Faculty member (role_id 2)
    const token = localStorage.getItem("token");
    const roleId = localStorage.getItem("role_id");
    
    if (!token || roleId !== "2") {
      router.push("/login");
    } else {
      // We will update this later to fetch their actual name!
      setUserName(localStorage.getItem("username") || "Teacher"); 
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Faculty Sidebar (Unified Maroon Theme) */}
      <aside className="w-64 bg-[#3e0f0f] text-white flex flex-col">
        <div className="p-6 text-center border-b border-[#5D1919]">
          <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center mb-4">
            <span className="text-[#3e0f0f] font-bold">LOGO</span>
          </div>
          <h2 className="font-bold text-lg tracking-wider uppercase">Faculty Portal</h2>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <div className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-2 mt-4">Overview</div>
          <Link href="/faculty/dashboard" className={`block px-4 py-2 rounded transition ${pathname.includes('/faculty/dashboard') ? 'bg-[#5D1919] text-white font-bold' : 'text-red-100 hover:bg-[#5D1919] hover:text-white'}`}>
            Dashboard
          </Link>
          
          <div className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-2 mt-6">Academics</div>
          <Link href="/faculty/my-classes" className={`block px-4 py-2 rounded transition ${pathname.includes('/faculty/my-classes') ? 'bg-[#5D1919] text-white font-bold' : 'text-red-100 hover:bg-[#5D1919] hover:text-white'}`}>
            My Classes
          </Link>
          <Link href="/faculty/advisory" className={`block px-4 py-2 rounded transition ${pathname.includes('/faculty/advisory') ? 'bg-[#5D1919] text-white font-bold' : 'text-red-100 hover:bg-[#5D1919] hover:text-white'}`}>
            Advisory Class
          </Link>
        </nav>

        <div className="p-4 border-t border-[#5D1919]">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-red-100 hover:text-white hover:bg-[#5D1919] rounded transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}