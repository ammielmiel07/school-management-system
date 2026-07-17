"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface ObservedValuesData {
  md_1: string;
  md_2: string;
  mt_1: string;
  mt_2: string;
  mk_1: string;
  mb_1: string;
  mb_2: string;
}

export default function ManageObservedValues() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // URL Parameters
  const learnerId = searchParams.get("learnerId");
  const studentName = searchParams.get("studentName") || "Unknown Learner";
  const sectionName = searchParams.get("sectionName") || "Unknown Section";

  // State
  const [schoolYear, setSchoolYear] = useState<string>("");
  const [trimester, setTrimester] = useState<string>("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [values, setValues] = useState<ObservedValuesData>({
    md_1: "", md_2: "", mt_1: "", mt_2: "", mk_1: "", mb_1: "", mb_2: ""
  });

  // Fetch School Year on Mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setSchoolYear(data.settings.current_school_year);
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      }
    };
    fetchSettings();
  }, [API_URL]);

  // Fetch Existing Values when Trimester changes
  useEffect(() => {
    if (!schoolYear || !learnerId) return;

    const fetchValues = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${API_URL}/api/faculty/core-values?learnerId=${learnerId}&schoolYear=${schoolYear}&trimester=${trimester}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        
        if (data.success && data.data) {
          setValues(data.data);
        } else {
          // Reset if no data exists for this trimester
          setValues({ md_1: "", md_2: "", mt_1: "", mt_2: "", mk_1: "", mb_1: "", mb_2: "" });
        }
      } catch (err) {
        console.error("Failed to fetch values", err);
      } finally {
        setLoading(false);
      }
    };

    fetchValues();
  }, [schoolYear, trimester, learnerId, API_URL]);

  const handleChange = (key: keyof ObservedValuesData, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/faculty/core-values`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId,
          schoolYear,
          trimester,
          ...values
        })
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Observed values saved successfully!" });
      } else {
        setMessage({ type: "error", text: "Failed to save observed values." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "A server error occurred." });
    } finally {
      setSaving(false);
    }
  };

  const observationOptions = [
    { value: "", label: "Select Observation" },
    { value: "AO", label: "AO - Always Observed" },
    { value: "SO", label: "SO - Sometimes Observed" },
    { value: "RO", label: "RO - Rarely Observed" },
    { value: "NO", label: "NO - Not Observed" }
  ];

  if (!learnerId) {
    return <div className="p-8 text-center text-red-500">Error: No Learner Selected.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Manage Observed Values</h1>
          <p className="text-sm text-gray-500 mt-1">
            Learner: <span className="text-gray-700">{studentName}</span> | Section: <span className="text-gray-700">{sectionName}</span> | Trimester: <span className="text-gray-700">{trimester}{trimester === "1" ? "st" : trimester === "2" ? "nd" : "rd"} Trimester</span>
          </p>
        </div>
        <button 
          onClick={() => router.back()}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50 transition"
        >
          &larr; Back to Advisory
        </button>
      </div>

      {/* Trimester Selector */}
      <div className="mb-6 w-64">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Trimester:</label>
        <select 
          value={trimester}
          onChange={(e) => setTrimester(e.target.value)}
          className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 text-gray-700"
        >
          <option value="1">1st Trimester</option>
          <option value="2">2nd Trimester</option>
          <option value="3">3rd Trimester</option>
        </select>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Main Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-6 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <span className="font-semibold text-gray-600">Loading data...</span>
          </div>
        )}
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1e1e1e] text-white text-sm">
              <th className="p-3 w-1/4 border-r border-gray-600">Core Values</th>
              <th className="p-3 w-1/2 border-r border-gray-600">Behavior Statements</th>
              <th className="p-3 w-1/4">Observation</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700 bg-white">
            
            {/* Maka-Diyos */}
            <tr className="border-b border-gray-200">
              <td rowSpan={2} className="p-3 border-r border-gray-200 font-bold text-center align-middle">Maka-Diyos</td>
              <td className="p-3 border-r border-gray-200 border-b border-gray-200">Expresses one's spiritual beliefs while respecting the spiritual beliefs of others</td>
              <td className="p-3 border-b border-gray-200">
                <select value={values.md_1} onChange={(e) => handleChange("md_1", e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none">
                  {observationOptions.map(opt => <option key={`md1-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="p-3 border-r border-gray-200">Shows adherence to ethical principles by upholding truth</td>
              <td className="p-3">
                <select value={values.md_2} onChange={(e) => handleChange("md_2", e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none">
                  {observationOptions.map(opt => <option key={`md2-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </td>
            </tr>

            {/* Makatao */}
            <tr className="border-b border-gray-200">
              <td rowSpan={2} className="p-3 border-r border-gray-200 font-bold text-center align-middle">Makatao</td>
              <td className="p-3 border-r border-gray-200 border-b border-gray-200">Is sensitive to individual, social, and cultural differences</td>
              <td className="p-3 border-b border-gray-200">
                <select value={values.mt_1} onChange={(e) => handleChange("mt_1", e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none">
                  {observationOptions.map(opt => <option key={`mt1-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="p-3 border-r border-gray-200">Demonstrates contributions toward solidarity</td>
              <td className="p-3">
                <select value={values.mt_2} onChange={(e) => handleChange("mt_2", e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none">
                  {observationOptions.map(opt => <option key={`mt2-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </td>
            </tr>

            {/* Makakalikasan */}
            <tr className="border-b border-gray-200">
              <td className="p-3 border-r border-gray-200 font-bold text-center align-middle">Makakalikasan</td>
              <td className="p-3 border-r border-gray-200">Cares for the environment and utilizes resources wisely, judiciously, and economically</td>
              <td className="p-3">
                <select value={values.mk_1} onChange={(e) => handleChange("mk_1", e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none">
                  {observationOptions.map(opt => <option key={`mk1-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </td>
            </tr>

            {/* Makabansa */}
            <tr className="border-b border-gray-200">
              <td rowSpan={2} className="p-3 border-r border-gray-200 font-bold text-center align-middle">Makabansa</td>
              <td className="p-3 border-r border-gray-200 border-b border-gray-200">Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen</td>
              <td className="p-3 border-b border-gray-200">
                <select value={values.mb_1} onChange={(e) => handleChange("mb_1", e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none">
                  {observationOptions.map(opt => <option key={`mb1-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="p-3 border-r border-gray-200">Demonstrates appropriate behavior in carrying out activities in the school, community, and country</td>
              <td className="p-3">
                <select value={values.mb_2} onChange={(e) => handleChange("mb_2", e.target.value)} className="w-full border border-gray-300 rounded p-1.5 focus:outline-none">
                  {observationOptions.map(opt => <option key={`mb2-${opt.value}`} value={opt.value}>{opt.label}</option>)}
                </select>
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      {/* Legend & Save Button Area */}
      <div className="flex justify-between items-end">
        {/* Legend */}
        <div className="bg-[#e0f7fa] border border-cyan-200 p-4 rounded-lg shadow-sm text-sm text-gray-800 w-full max-w-md">
          <p className="font-bold mb-2 text-gray-700">Legend:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>AO</strong> = Always Observed</li>
            <li><strong>SO</strong> = Sometimes Observed</li>
            <li><strong>RO</strong> = Rarely Observed</li>
            <li><strong>NO</strong> = Not Observed</li>
          </ul>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-[#1a56db] text-white px-6 py-2.5 rounded shadow hover:bg-blue-700 transition flex items-center font-medium disabled:opacity-50"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {saving ? "Saving..." : "Save Observed Values"}
        </button>
      </div>

    </div>
  );
}