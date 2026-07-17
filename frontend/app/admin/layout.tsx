"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const roleId = localStorage.getItem("role_id");

    if (!token || roleId !== "1") {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* 1. The Maroon Sidebar */}
      <aside className="w-64 flex flex-col shadow-xl" style={{ backgroundColor: "#3e0f0f" }}>
        
        {/* School Logo / Branding Area */}
        <div className="flex flex-col items-center justify-center p-6 border-b border-red-900">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-3 overflow-hidden">
            <img 
                src="/Prudencia-Logo.png" 
                alt="School Logo" 
                className="w-full h-full object-contain p-1" 
            />
          </div>
          <h2 className="text-white font-bold text-lg tracking-wider">ADMIN</h2>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto text-gray-300">
          
          <div>
            <h3 className="text-xs uppercase font-bold text-red-300 mb-2 tracking-wider">Overview</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/admin/dashboard" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin/calendar" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Calendar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs uppercase font-bold text-red-300 mb-2 tracking-wider">User Management</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/admin/accounts" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Manage Accounts
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs uppercase font-bold text-red-300 mb-2 tracking-wider">Academics</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/admin/faculty-loads" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Faculty Loads
                </Link>
              </li>
              <li>
                <Link href="/admin/advisers" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Homeroom Advisers
                </Link>
              </li>
              <li>
                <Link href="/admin/subjects" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Manage Subjects
                </Link>
              </li>
              <li>
                <Link href="/admin/sections" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Manage Sections
                </Link>
              </li>
              <li>
                <Link href="/admin/enrollments" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Enroll Students (Sectioning)
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs uppercase font-bold text-red-300 mb-2 tracking-wider">Configuration</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/admin/grading-setup" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  Grading Setup
                </Link>
              </li>
              <li>
                <Link href="/admin/settings" className="block px-3 py-2 rounded hover:bg-red-900 hover:text-white transition">
                  System Settings
                </Link>
              </li>
            </ul>
          </div>

        </nav>

        {/* Bottom Profile / Logout Area */}
        <div className="p-4 border-t border-red-900">
          <button 
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-gray-300 rounded hover:bg-red-900 hover:text-white transition"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* 2. The Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* The {children} prop is where your page.tsx content automatically injects itself! */}
        {children}
      </main>

    </div>
  );
}
