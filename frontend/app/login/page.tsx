"use client";

import { apiFetch, clearSession, errorMessage } from '@/lib/api';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; 

const raleway = { className: "font-sans font-black" };
const inter = { className: "font-sans" };

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter(); 
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('expired')) setNotice('Your session has expired. Please log in again.');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (res.ok) {
        clearSession();
        if (data.requires_reset) {
          localStorage.setItem("reset_token", data.token);
          router.replace("/setup-password");
          return;
        }

        const destinations: Record<number, string> = { 1: '/admin/dashboard', 2: '/faculty/dashboard', 3: '/learner/dashboard', 4: '/parent/dashboard' };
        if (!data.token || !destinations[data.user?.role_id]) throw new Error('The account has an unsupported role. Please contact the administrator.');
        localStorage.setItem("token", data.token);
        localStorage.setItem("role_id", data.user.role_id);
        
        router.replace(destinations[data.user.role_id]);
        
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError(errorMessage(err, 'Unable to log in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen p-4 flex items-center justify-center bg-gray-100 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/school-bg.png')" }}
    >
      {/* Dark overlay to make the login form stand out */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Login Box - Added z-10 relative to sit above the overlay */}
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-sm relative z-10">
        
        {/* Updated Title with Raleway and Maroon color */}
        <h2 className={`text-3xl text-center font-weight-bold mb-3 text-[#333333] ${raleway.className}`}>
          WELCOME TO POMS
        </h2>
        
        {/* Updated Sub-title with Inter */}
        <h3 className={`text-center mb-4 text-gray-500 text-xs leading-relaxed ${inter.className}`}>
          PRUDENCIA D. FULE MEMORIAL NATIONAL HIGH SCHOOL ONLINE MANAGEMENT SYSTEM
        </h3>
        
        {notice && <p role="status" className="text-sm bg-amber-50 text-amber-800 p-3 rounded mb-4">{notice}</p>}
        {error && (
          <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">Username</label>
            <input 
              type="text" 
              id="username"
              autoComplete="username"
              maxLength={50}
              disabled={loading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#800000]"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input 
              type="password" 
              id="password"
              autoComplete="current-password"
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#800000]"
              required
            />
          </div>

          {/* Updated Login Button to Maroon */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#3e0f0f] text-white font-bold py-2 px-4 rounded hover:bg-[#600000] transition duration-200 mt-2 disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Log In'}
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
