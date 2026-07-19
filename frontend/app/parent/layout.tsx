"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Raleway, Inter } from "next/font/google";

// Initialize fonts
const raleway = Raleway({ subsets: ["latin"], weight: "700" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"] });

// Organized navigation structure
const navLinks = [
  { href: "/parent/dashboard", label: "Dashboard" },
  { href: "/parent/child-grades", label: "Child Grades" },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); 

  useEffect(() => {
    const token = localStorage.getItem("token");
    const roleId = localStorage.getItem("role_id");

    // Role ID 4 is the Parent
    if (!token || roleId !== "4") {
      router.push("/login");
      return;
    }

  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className={`flex h-screen bg-gray-100 ${inter.className}`}>
      
      {/* The Maroon Sidebar */}
      <aside className="w-64 flex flex-col shadow-xl" style={{ backgroundColor: "#3e0f0f" }}>
        
        {/* School Logo / Branding Area */}
        <div className="flex flex-col items-center justify-center p-6 border-b border-red-900">
          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mb-4 overflow-hidden shadow-lg">
            <img 
                src="/Prudencia-Logo.png" 
                alt="School Logo" 
                className="w-full h-full object-contain p-1" 
            />
          </div>
          <h2 className={`text-white text-xl tracking-wider uppercase ${raleway.className}`}>
            Parent Portal
          </h2>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <div className={`text-xs uppercase text-red-300 mb-3 tracking-wider ${raleway.className}`}>
            Academics
          </div>
          
          <ul className="space-y-1">
            {navLinks.map((link, index) => {
              const isActive = pathname === link.href;
              return (
                <li key={index}>
                  <Link 
                    href={link.href} 
                    className={`block px-3 py-2 rounded-md transition-colors duration-200 font-medium ${
                      isActive 
                        ? 'bg-red-900 text-white' 
                        : 'text-gray-300 hover:bg-red-900 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Profile / Logout Area */}
        <div className="p-4 border-t border-red-900">
          <button 
            onClick={handleLogout} 
            className="w-full text-left px-3 py-2 text-gray-300 rounded-md hover:bg-red-900 hover:text-white transition-colors duration-200 font-medium"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* The Main Content Area */}
      <main className="flex-1 overflow-y-auto">{children}</main>
      
    </div>
  );
}