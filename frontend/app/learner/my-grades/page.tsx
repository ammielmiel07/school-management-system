"use client";

import { apiFetch } from '@/lib/api';
import { useEffect, useRef, useState } from "react";

interface Learner {
  lrn: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
}

interface Enrollment {
  section_name: string;
  grade_level: string | number;
  grades_visible: boolean; // Added visibility flag
}

interface Grade {
  subject_name: string;
  initial_grade: string | number | null;
  transmuted_grade: string | number | null;
  faculty_first_name: string;
  faculty_last_name: string;
}

interface LearnerGradesResponse {
  school_year?: string;
  active_trisemester?: number;
  learner: Learner | null;
  enrollment: Enrollment | null;
  grades: Grade[];
}

export default function MyGrades() {
  const [data, setData] = useState<LearnerGradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [trimester, setTrimester] = useState<number>(1);
  const [globalActiveTrimester, setGlobalActiveTrimester] = useState<number | null>(null);

  const requestSequence = useRef(0);
  const fetchGrades = async (targetTri: number) => {
    const requestId = ++requestSequence.current;
    setError("");
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await apiFetch(`/api/learner/grades?trimester=${targetTri}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (requestId !== requestSequence.current) return;

      if (!res.ok) {
        setError(payload.error || "Failed to load grades.");
        return;
      }

      setData(payload);

      if (globalActiveTrimester === null && payload.active_trisemester) {
        setGlobalActiveTrimester(payload.active_trisemester);
        setTrimester(payload.active_trisemester);
      }
    } catch {
      if (requestId === requestSequence.current) setError("Cannot connect to the server.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades(trimester);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimester]);

  const handleTabChange = (tri: number) => {
    setTrimester(tri);
    fetchGrades(tri);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">My Grades</h1>
        <p className="text-gray-600 mt-1">
          Active school year {data?.school_year || "-"}
        </p>
      </div>

      {/* Trimester Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
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

      {loading && <p className="text-gray-500 italic">Loading your grades...</p>}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 font-semibold shadow-sm mb-6">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Learner Profile Details */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-800">
              {data.learner ? `${data.learner.last_name}, ${data.learner.first_name}` : "Learner profile not found"}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              <p><strong>LRN:</strong> {data.learner?.lrn || "-"}</p>
              <p><strong>Section:</strong> {data.enrollment ? `${data.enrollment.grade_level} - ${data.enrollment.section_name}` : "Not enrolled for the active school year"}</p>
            </div>
          </section>

          {/* Grades Table */}
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto" tabIndex={0} aria-label="Subject grades; scroll horizontally for all columns">
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
                {!data.enrollment ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center bg-gray-50 border-t border-gray-200">
                      <span className="text-3xl block mb-2">🚷</span>
                      <p className="text-gray-600 font-semibold">No Active Enrollment</p>
                      <p className="text-gray-500 text-sm mt-1">You are not assigned to a section for the active school year.</p>
                    </td>
                  </tr>
                ) : !data.enrollment.grades_visible ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center bg-gray-50 border-t border-gray-200">
                      <span className="text-3xl block mb-2">🔒</span>
                      <p className="text-gray-600 font-semibold">Grades are currently hidden.</p>
                      <p className="text-gray-500 text-sm mt-1">Your class adviser has not yet published the grades for this term.</p>
                    </td>
                  </tr>
                ) : data.grades.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 sm:p-8 text-center text-gray-500 italic">
                      No grades have been posted for this trisemester yet.
                    </td>
                  </tr>
                ) : (
                  data.grades.map((grade) => {
                    const finalScore = grade.transmuted_grade ? parseFloat(String(grade.transmuted_grade)) : null;
                    const isPassed = finalScore !== null && finalScore >= 75;

                    return (
                      <tr key={grade.subject_name} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="p-4 font-bold text-gray-800">{grade.subject_name}</td>
                        <td className="p-4 text-gray-600 text-sm">{grade.faculty_first_name} {grade.faculty_last_name}</td>
                        <td className="p-4 text-center text-gray-500 font-mono">
                          {grade.initial_grade != null ? parseFloat(String(grade.initial_grade)).toFixed(2) : "—"}
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
        </div>
      )}
    </div>
  );
}
