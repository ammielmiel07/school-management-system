"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Ensure they actually have a reset token before viewing this page
  useEffect(() => {
    const token = localStorage.getItem("reset_token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("reset_token");

    try {
      const res = await fetch("http://localhost:5000/api/auth/setup-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Pass the temporary token
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        // Clear the temporary token and force them to log in with their new password
        localStorage.removeItem("reset_token");
        alert("Password setup complete! Please log in with your new credentials.");
        router.push("/login");
      } else {
        setError(data.error || "Failed to update password.");
      }
    } catch (err) {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md border-t-4 border-t-[#5D1919]">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#5D1919] text-white rounded-full mx-auto flex items-center justify-center mb-4 font-bold">
            LOGO
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Welcome!</h2>
          <p className="text-sm text-gray-600 mt-2">
            For your security, please change your temporary password before accessing your account.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-[#5D1919]/50 focus:border-[#5D1919]"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-[#5D1919]/50 focus:border-[#5D1919]"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5D1919] hover:bg-[#3e0f0f] text-white font-bold py-3 px-4 rounded transition shadow-sm disabled:opacity-70 mt-4"
          >
            {loading ? "Updating..." : "Save Password & Login"}
          </button>
        </form>
      </div>
    </div>
  );
}