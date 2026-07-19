"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to process request.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Cannot connect to the server. Is your backend running?");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4" style={{ backgroundImage: "url('/school-bg.png')" }}>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">Reset Password</h2>
        <p className="text-center text-sm text-gray-600 mb-6">
          Enter your Username, LRN, or Employee Number. We will send a temporary password to your registered email address.
        </p>

        {status === "success" ? (
          <div className="text-center">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded mb-6">
              <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {message}
            </div>
            <Link 
              href="/login" 
              className="inline-block w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition duration-200"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === "error" && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm text-center">
                {message}
              </div>
            )}

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Username / ID</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                placeholder="e.g. 109384729483 or P-109384729483"
                required
                disabled={status === "loading"}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={status === "loading"}
              className={`w-full font-bold py-2 px-4 rounded transition duration-200 text-white
                ${status === "loading" ? "bg-blue-400 cursor-not-allowed" : "bg-[#3e0f0f] hover:bg-[#600000]"}`}
            >
              {status === "loading" ? "Processing..." : "Send Reset Link"}
            </button>

            <div className="text-center mt-4">
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}