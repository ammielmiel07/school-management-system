"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; 
import { Raleway, Inter } from "next/font/google";

// Initialize the fonts
const raleway = Raleway({ subsets: ["latin"], weight: "900" }); // Bold
const inter = Inter({ subsets: ["latin"], weight: "400" });   // Regular

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter(); 

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.requires_reset) {
          localStorage.setItem("reset_token", data.token);
          router.push("/setup-password");
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("role_id", data.user.role_id);
        
        if (data.user.role_id === 1) router.push("/admin/dashboard");
        else if (data.user.role_id === 2) router.push("/faculty/dashboard");
        else if (data.user.role_id === 3) router.push("/learner/dashboard");
        else if (data.user.role_id === 4) router.push("/parent/dashboard");
        
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Cannot connect to the server. Is your backend running?");
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gray-100 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/school-bg.png')" }}
    >
      {/* Dark overlay to make the login form stand out */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Login Box - Added z-10 relative to sit above the overlay */}
      <div className="bg-white p-8 rounded-lg shadow-md w-96 relative z-10">
        
        {/* Updated Title with Raleway and Maroon color */}
        <h2 className={`text-3xl text-center font-weight-bold mb-3 text-[#333333] ${raleway.className}`}>
          WELCOME TO POMS
        </h2>
        
        {/* Updated Sub-title with Inter */}
        <h3 className={`text-center mb-4 text-gray-500 text-xs leading-relaxed ${inter.className}`}>
          PRUDENCIA D. FULE MEMORIAL NATIONAL HIGH SCHOOL ONLINE MANAGEMENT SYSTEM
        </h3>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#800000]"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#800000]"
              required
            />
          </div>

          {/* Updated Login Button to Maroon */}
          <button 
            type="submit" 
            className="w-full bg-[#3e0f0f] text-white font-bold py-2 px-4 rounded hover:bg-[#600000] transition duration-200 mt-2"
          >
            Log In
          </button>

          {/* Updated Forgot Password Link to Maroon */}
          <div className="flex justify-center mt-1 mb-2">
            <Link href="/forgot-password" className="text-sm text-[#800000] hover:text-[#600000] hover:underline transition">
              Forgot Password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}