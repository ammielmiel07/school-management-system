"use client";

import { apiFetch } from '@/lib/api';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SystemSettings() {
  const [schoolYear, setSchoolYear] = useState("");
  const [trisemester, setTrisemester] = useState<number>(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();

  // Generate dynamic school years (15 years back to 5 years ahead)
  const getDynamicSchoolYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 15; i <= currentYear + 5; i++) {
      years.push(`${i}-${i + 1}`);
    }
    return years;
  };

  const schoolYearOptions = getDynamicSchoolYears();

  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const response = await apiFetch("/api/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (response.ok && data.settings) {
          setSchoolYear(data.settings.current_school_year);
          setTrisemester(data.settings.active_trisemester);
        } else {
          setError(data.error || "Could not load system settings.");
        }
      } catch {
        setError("Could not load system settings.");
      } finally {
        setInitializing(false);
      }
    };

    fetchSettings();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || initializing) return;
    setMessage("");
    setError("");
    setLoading(true);

    const token = localStorage.getItem("token");

    try {
      const response = await apiFetch("/api/settings", {
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
    } catch {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* HEADER SECTION */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <svg className="w-8 h-8 text-[#3e0f0f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          System Settings
        </h1>
        <p className="text-gray-600 text-sm mt-1">Configure global variables governing active enrollment and grading windows.</p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        {/* Decorative Maroon Banner */}
        <div className="h-2 bg-[#3e0f0f] w-full" />
        
        <div className="p-4 sm:p-8">
          {message && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-700 font-semibold text-sm">{message}</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-700 font-semibold text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* School Year Dropdown */}
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">
                  Active School Year
                </label>
                <select
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#3e0f0f]/30 focus:border-[#3e0f0f]"
                  required
                >
                  <option value="" disabled>Select School Year</option>
                  {schoolYearOptions.map((sy) => (
                    <option key={sy} value={sy}>{sy}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2 italic">
                  Defines the current timeline for enrollment and class loading.
                </p>
              </div>

              {/* Active Trimester Dropdown */}
              <div>
                <label className="block text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">
                  Active Trisemester
                </label>
                <select 
                  value={trisemester}
                  onChange={(e) => setTrisemester(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#3e0f0f]/30 focus:border-[#3e0f0f]"
                >
                  <option value={1}>1st Trisemester</option>
                  <option value={2}>2nd Trisemester</option>
                  <option value={3}>3rd Trisemester</option>
                </select>
                <p className="text-xs text-gray-500 mt-2 italic">
                  Only the selected term will allow faculty member grade entry.
                </p>
              </div>

            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button 
                type="submit" 
                disabled={loading || initializing || !schoolYear}
                className="bg-green-700 text-white font-bold py-3 px-8 rounded shadow-sm hover:bg-green-800 transition duration-200 disabled:opacity-50"
              >
                {initializing ? 'Loading settings…' : loading ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
