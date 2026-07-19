"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Raleway, Inter } from "next/font/google";

// Initialize fonts
const raleway = Raleway({ subsets: ["latin"], weight: "700" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"] });

// Organized navigation structure for cleaner and more maintainable code
const navGroups = [
  {
    title: "Overview",
    links: [
      { href: "/admin/dashboard", label: "Dashboard" },
      { href: "/admin/calendar", label: "Calendar" },
    ],
  },
  {
    title: "User Management",
    links: [
      { href: "/admin/accounts", label: "Manage Accounts" },
    ],
  },
  {
    title: "Academics",
    links: [
      { href: "/admin/faculty-loads", label: "Faculty Loads" },
      { href: "/admin/advisers", label: "Homeroom Advisers" },
      { href: "/admin/subjects", label: "Manage Subjects" },
      { href: "/admin/sections", label: "Manage Sections" },
      { href: "/admin/enrollments", label: "Enroll Students (Sectioning)" },
    ],
  },
  {
    title: "Configuration",
    links: [
      { href: "/admin/grading-setup", label: "Grading Setup" },
      { href: "/admin/settings", label: "System Settings" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // State to manage mobile sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    <div className={`flex h-screen bg-gray-100 ${inter.className}`}>
      
      {/* Mobile Overlay Background - Shows only when sidebar is open on mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* 1. The Maroon Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[#3e0f0f] flex flex-col shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}
      >
        
        {/* School Logo / Branding Area */}
        <div className="flex flex-col items-center justify-center p-6 border-b border-red-900 relative">
          
          {/* Close button for mobile */}
          <button 
            className="absolute top-4 right-4 text-gray-300 hover:text-white md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mb-4 overflow-hidden shadow-lg mt-2">
            <img 
              src="/Prudencia-Logo.png" 
              alt="School Logo" 
              className="w-full h-full object-contain p-1" 
            />
          </div>
          <h2 className={`text-white text-xl tracking-wider ${raleway.className}`}>
            ADMIN
          </h2>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto text-gray-300">
          {navGroups.map((group, index) => (
            <div key={index}>
              <h3 className={`text-xs uppercase text-red-300 mb-3 tracking-wider ${raleway.className}`}>
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link 
                      href={link.href} 
                      onClick={() => setIsSidebarOpen(false)} // Close sidebar when a link is clicked on mobile
                      className="block px-3 py-2 rounded-md hover:bg-red-900 hover:text-white transition-colors duration-200 font-medium"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Profile / Logout Area */}
        <div className="p-4 border-t border-red-900">
          <button 
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-gray-300 rounded-md hover:bg-red-900 hover:text-white transition-colors duration-200 font-medium"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* 2. The Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Mobile Header Bar - Only visible on small screens */}
        <header className="bg-[#3e0f0f] text-white p-4 flex items-center justify-between shadow-md md:hidden flex-shrink-0">
          <h1 className={`font-bold tracking-wider ${raleway.className}`}>POMS ADMIN</h1>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1 text-gray-300 hover:text-white focus:outline-none"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>

    </div>
  );
}