"use client";

import { useEffect, useState } from "react";

interface Learner {
  lrn: string;
  first_name: string;
  middle_name: string | null;
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

interface ChildData {
  learner: Learner | null;
  enrollment: Enrollment | null;
  grades: Grade[];
}

interface ParentGradesResponse {
  school_year?: string;
  active_trisemester?: number;
  children: ChildData[];
}

export default function ParentDashboard() {
  const [data, setData] = useState<ParentGradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchChildrenGrades = async () => {
      const token = localStorage.getItem("token");

      try {
        const res = await fetch("http://localhost:5000/api/parent/children-grades", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();

        if (!res.ok) {
          setError(payload.error || "Failed to load children's grades.");
          return;
        }

        setData(payload);
      } catch {
        setError("Cannot connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchChildrenGrades();
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800">My Children's Grades</h1>
          <p className="text-gray-600 mt-1">
            Active School Year: <span className="font-semibold">{data?.school_year || "-"}</span> | Trimester: <span className="font-semibold">{data?.active_trisemester || "-"}</span>
          </p>
        </div>

        {loading && <p className="text-gray-500 italic">Loading academic records...</p>}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 font-semibold mb-6">
            {error}
          </div>
        )}

        {!loading && !error && data && data.children.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Linked Records</h2>
            <p className="text-gray-500">We could not find any active learner records linked to your account. Please contact the school administrator.</p>
          </div>
        )}

        {!loading && !error && data && data.children.length > 0 && (
          <div className="space-y-10">
            {data.children.map((child, index) => (
              <div key={index} className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                {/* Child Header */}
                <div className="bg-[#3e0f0f] text-white p-5 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">
                      {child.learner ? `${child.learner.last_name}, ${child.learner.first_name}` : "Unknown Learner"}
                    </h2>
                    <p className="text-red-200 text-sm mt-1 font-mono">LRN: {child.learner?.lrn || "-"}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs uppercase font-bold text-red-300 tracking-wider">Grade & Section</span>
                    <span className="font-bold text-lg">
                      {child.enrollment ? `${child.enrollment.grade_level} - ${child.enrollment.section_name}` : "Not Enrolled"}
                    </span>
                  </div>
                </div>

                {/* Child Grades Table */}
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-sm uppercase tracking-wider border-b border-gray-300">
                      <th className="p-4 font-bold border-r border-gray-200">Learning Area</th>
                      <th className="p-4 font-bold border-r border-gray-200">Teacher</th>
                      <th className="p-4 font-bold text-center border-r border-gray-200">Initial Grade</th>
                      <th className="p-4 font-bold text-center">Trimester Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {child.grades.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                          No grades have been posted for the active trimester yet.
                        </td>
                      </tr>
                    ) : (
                      child.grades.map((grade) => (
                        <tr key={grade.subject_name} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-4 font-semibold text-gray-800 border-r border-gray-200">{grade.subject_name}</td>
                          <td className="p-4 text-gray-600 border-r border-gray-200">{grade.faculty_first_name} {grade.faculty_last_name}</td>
                          <td className="p-4 text-center text-gray-700 border-r border-gray-200">{grade.initial_grade ?? "-"}</td>
                          <td className="p-4 text-center font-extrabold text-base text-[#147a3e]">{grade.transmuted_grade ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}