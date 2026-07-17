"use client";

import { useEffect, useState } from "react";

interface Learner {
  lrn: string;
  first_name: string;
  last_name: string;
}

interface Enrollment {
  section_name: string;
  grade_level: string | number;
}

interface Grade {
  subject_name: string;
  initial_grade: string | number | null;
  transmuted_grade: string | number | null;
  faculty_first_name: string;
  faculty_last_name: string;
}

interface ChildGrades {
  learner: Learner | null;
  enrollment: Enrollment | null;
  grades: Grade[];
}

interface ParentGradesResponse {
  school_year?: string;
  active_trisemester?: number;
  children: ChildGrades[];
}

export default function ParentDashboard() {
  const [data, setData] = useState<ParentGradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // New States for Trimester Tracking
  const [trimester, setTrimester] = useState<number>(1);
  const [globalActiveTrimester, setGlobalActiveTrimester] = useState<number | null>(null);

  const fetchGrades = async (targetTri: number) => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      // Appended the trimester variable to the API URL
      const res = await fetch(`http://localhost:5000/api/parent/children-grades?trimester=${targetTri}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload.error || "Failed to load child grades.");
        return;
      }

      setData(payload);
      
      // Sync the UI to the system's active trimester on initial load
      if (globalActiveTrimester === null && payload.active_trisemester) {
        setGlobalActiveTrimester(payload.active_trisemester);
        setTrimester(payload.active_trisemester); 
      }
    } catch {
      setError("Cannot connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades(trimester);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (tri: number) => {
    setTrimester(tri);
    fetchGrades(tri);
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Child Grades</h1>
          <p className="text-gray-600 mt-1">
            Active school year {data?.school_year || "-"}
          </p>
        </div>

        {/* Trimester Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
          {[1, 2, 3].map((tri) => (
            <button
              key={tri}
              onClick={() => handleTabChange(tri)}
              className={`px-6 py-2 rounded-full font-bold transition-colors text-sm shadow-sm flex items-center gap-1.5 ${
                trimester === tri 
                  ? "bg-[#5D1919] text-white" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tri === 1 ? "1st" : tri === 2 ? "2nd" : "3rd"} Trimester
              {globalActiveTrimester === tri && (
                <span className={`text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-full ${trimester === tri ? "bg-white text-[#5D1919]" : "bg-green-600 text-white"}`}>
                  Active
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-500 italic">Loading grades...</p>}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 font-semibold shadow-sm mb-6">
            {error}
          </div>
        )}

        {!loading && !error && data && data.children.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center text-gray-500">
            No linked learners were found for this parent account.
          </div>
        )}

        {!loading && !error && data && data.children.length > 0 && (
          <div className="space-y-8">
            {data.children.map((child) => (
              <section key={child.learner?.lrn || "child"} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-800">
                    {child.learner ? `${child.learner.last_name}, ${child.learner.first_name}` : "Learner profile not found"}
                  </h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <p><strong>LRN:</strong> {child.learner?.lrn || "-"}</p>
                    <p><strong>Section:</strong> {child.enrollment ? `${child.enrollment.grade_level} - ${child.enrollment.section_name}` : "Not enrolled for the active school year"}</p>
                  </div>
                </div>

                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-gray-600 text-sm font-bold uppercase tracking-wider">
                      <th className="p-4">Subject</th>
                      <th className="p-4">Teacher</th>
                      <th className="p-4 text-center">Initial Grade</th>
                      <th className="p-4 text-center">Trimester Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {child.grades.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                          No grades have been posted for this trisemester yet.
                        </td>
                      </tr>
                    ) : (
                      child.grades.map((grade) => {
                        const finalScore = grade.transmuted_grade ? parseFloat(String(grade.transmuted_grade)) : null;
                        const isPassed = finalScore !== null && finalScore >= 75;

                        return (
                          <tr key={`${child.learner?.lrn}-${grade.subject_name}`} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="p-4 font-bold text-gray-800">{grade.subject_name}</td>
                            <td className="p-4 text-gray-600 text-sm">{grade.faculty_first_name} {grade.faculty_last_name}</td>
                            <td className="p-4 text-center text-gray-500 font-mono">
                               {grade.initial_grade ? parseFloat(String(grade.initial_grade)).toFixed(2) : "—"}
                            </td>
                            <td className={`p-4 text-center font-extrabold text-lg ${finalScore ? (isPassed ? "text-[#147a3e]" : "text-red-600") : "text-gray-400"}`}>
                              {finalScore || "TBA"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}