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

  useEffect(() => {
    const fetchGrades = async () => {
      const token = localStorage.getItem("token");

      try {
        const res = await fetch("http://localhost:5000/api/parent/children-grades", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();

        if (!res.ok) {
          setError(payload.error || "Failed to load child grades.");
          return;
        }

        setData(payload);
      } catch {
        setError("Cannot connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchGrades();
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Child Grades</h1>
          <p className="text-gray-600 mt-1">
            Active school year {data?.school_year || "-"} - Trisemester {data?.active_trisemester || "-"}
          </p>
        </div>

        {loading && <p className="text-gray-500">Loading grades...</p>}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 font-semibold">
            {error}
          </div>
        )}

        {!loading && !error && data && data.children.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center text-gray-500">
            No linked learners were found for this parent account.
          </div>
        )}

        {!loading && !error && data && data.children.length > 0 && (
          <div className="space-y-6">
            {data.children.map((child) => (
              <section key={child.learner?.lrn || "child"} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-800">
                    {child.learner ? `${child.learner.last_name}, ${child.learner.first_name}` : "Learner profile not found"}
                  </h2>
                  <p className="text-gray-600 mt-1">LRN: {child.learner?.lrn || "-"}</p>
                  <p className="text-gray-600">
                    Section: {child.enrollment ? `${child.enrollment.grade_level} - ${child.enrollment.section_name}` : "Not enrolled for the active school year"}
                  </p>
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#5D1919] text-white text-sm uppercase tracking-wider">
                      <th className="p-3">Subject</th>
                      <th className="p-3">Teacher</th>
                      <th className="p-3 text-center">Initial Grade</th>
                      <th className="p-3 text-center">Trimester Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {child.grades.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                          No grades have been posted for the active trisemester yet.
                        </td>
                      </tr>
                    ) : (
                      child.grades.map((grade) => (
                        <tr key={`${child.learner?.lrn}-${grade.subject_name}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-semibold text-gray-800">{grade.subject_name}</td>
                          <td className="p-3 text-gray-600">{grade.faculty_first_name} {grade.faculty_last_name}</td>
                          <td className="p-3 text-center text-gray-700">{grade.initial_grade ?? "-"}</td>
                          <td className="p-3 text-center font-bold text-[#147a3e]">{grade.transmuted_grade ?? "-"}</td>
                        </tr>
                      ))
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
