"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SystemSettings() {
  const [schoolYear, setSchoolYear] = useState("");
  const [trisemester, setTrisemester] = useState<number>(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Fetch the current settings when the page loads
    const fetchSettings = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch("http://localhost:5000/api/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (response.ok && data.settings) {
          setSchoolYear(data.settings.current_school_year);
          setTrisemester(data.settings.active_trisemester);
        }
      } catch (err) {
        setError("Could not load system settings.");
      }
    };

    fetchSettings();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const token = localStorage.getItem("token");

    try {
      const response = await fetch("http://localhost:5000/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_school_year: schoolYear,
          active_trisemester: trisemester,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("System settings updated successfully!");
      } else {
        setError(data.error || "Failed to update settings.");
      }
    } catch (err) {
      setError("Server connection error.");
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">System Settings</h1>
        
        {message && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <p className="text-green-700 font-semibold">{message}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Active School Year
            </label>
            <input 
              type="text" 
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="e.g., 2026-2027"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-red-900"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Format: YYYY-YYYY</p>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Active Trisemester
            </label>
            <select 
              value={trisemester}
              onChange={(e) => setTrisemester(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-red-900"
            >
              <option value={1}>1st Trisemester</option>
              <option value={2}>2nd Trisemester</option>
              <option value={3}>3rd Trisemester</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="bg-green-700 text-white font-bold py-2 px-6 rounded hover:bg-green-800 transition duration-200"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}