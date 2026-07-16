"use client";

import { useState, useEffect } from "react";

interface Subject {
  id: number;
  subject_name: string;
  ww_weight: string;
  pt_weight: string;
  ex_weight: string;
}

export default function GradingSetup() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGradingSetup = async () => {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch("http://localhost:5000/api/admin/grading", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        
        if (response.ok) {
          setSubjects(data.subjects);
        } else {
          setError(data.error || "Failed to load grading setup.");
        }
      } catch (err) {
        setError("Server connection error.");
      } finally {
        setLoading(false);
      }
    };

    fetchGradingSetup();
  }, []);

  // Helper function to format decimal (0.20) to percentage (20%)
  const formatPercent = (decimalStr: string) => {
    const num = parseFloat(decimalStr);
    return `${(num * 100).toFixed(0)}%`;
  };

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          Grading System Setup
        </h1>
        <p className="text-gray-600 mb-6 text-sm">
          Overview of the DepEd standardized weighted components per learning area. These weights are used automatically by the system to compute final grades.
        </p>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded shadow-sm">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}

        <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
          <h2 className="text-xl font-bold text-gray-700 mb-4">Weight of the Components (KS2 to KS4)</h2>
          
          {loading ? (
            <p className="text-gray-500 italic">Loading grading matrices...</p>
          ) : (
            <div className="overflow-x-auto border border-gray-300 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 border-b-2 border-gray-300">
                    <th className="p-4 font-bold border-r border-gray-300">Learning Area / Subject Group</th>
                    <th className="p-4 font-bold text-center border-r border-gray-300">Written Works (WWs)</th>
                    <th className="p-4 font-bold text-center border-r border-gray-300">Performance Tasks (PTs)</th>
                    <th className="p-4 font-bold text-center">Quarterly Exams (EXs)</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject, index) => (
                    <tr key={subject.id} className={`border-b border-gray-200 transition ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                      <td className="p-4 text-gray-800 font-medium border-r border-gray-200">{subject.subject_name}</td>
                      <td className="p-4 text-gray-800 text-center border-r border-gray-200">{formatPercent(subject.ww_weight)}</td>
                      <td className="p-4 text-gray-800 text-center border-r border-gray-200">{formatPercent(subject.pt_weight)}</td>
                      <td className="p-4 text-gray-800 text-center">{formatPercent(subject.ex_weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-4 bg-blue-50 p-4 rounded text-blue-800 text-sm border border-blue-200 flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p><strong>Note:</strong> The numerical grading system computes grades from WWs, PTs, and EXs using these assigned weights. The system will automatically run the initial grades through the standard DepEd Transmutation Table before finalizing.</p>
          </div>
        </div>

      </div>
    </div>
  );
}