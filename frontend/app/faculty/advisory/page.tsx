"use client";

import { useEffect, useState } from "react";

interface Student {
  enrollment_id: number;
  lrn: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string;
}

interface GradeRecord {
  enrollment_id: number;
  trimester: number;
  transmuted_grade: number;
  subject_name: string;
}

export default function AdvisoryClass() {
  const [isAdviser, setIsAdviser] = useState(false);
  const [section, setSection] = useState<any>(null);
  const [schoolYear, setSchoolYear] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [allGrades, setAllGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Report Card Modal State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchAdvisoryData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/faculty/advisory-class", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setIsAdviser(data.isAdviser);
        if (data.isAdviser) {
          setSection(data.section);
          setSchoolYear(data.school_year);
          setStudents(data.students || []);
          setAllGrades(data.grades || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch advisory class.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisoryData();
  }, []);

  // Helper to compile grades for a single student card
  const getStudentCardData = (enrollmentId: number) => {
    const studentGrades = allGrades.filter(g => g.enrollment_id === enrollmentId);
    
    // Group grades by Subject Name
    const subjectsMap: Record<string, { tri1: number | null; tri2: number | null; tri3: number | null }> = {};
    
    studentGrades.forEach(g => {
      if (!subjectsMap[g.subject_name]) {
        subjectsMap[g.subject_name] = { tri1: null, tri2: null, tri3: null };
      }
      if (g.trimester === 1) subjectsMap[g.subject_name].tri1 = Number(g.transmuted_grade);
      if (g.trimester === 2) subjectsMap[g.subject_name].tri2 = Number(g.transmuted_grade);
      if (g.trimester === 3) subjectsMap[g.subject_name].tri3 = Number(g.transmuted_grade);
    });

    return subjectsMap;
  };

  const handleViewReportCard = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800">My Advisory Class</h1>
        <p className="text-gray-600 mt-1">Manage homeroom roster and generate consolidated SF9 Report Cards.</p>
      </div>

      {loading ? (
        <p className="p-8 text-center text-gray-500 italic">Loading advisory roster...</p>
      ) : !isAdviser ? (
        <div className="bg-white p-12 rounded-lg shadow-sm border text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#5D1919]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Section Assigned</h2>
          <p className="text-gray-500">You are not designated as an Adviser for any class section in S.Y. {schoolYear}. Please contact the Admin.</p>
        </div>
      ) : (
        <>
          {/* Section Banner */}
          <div className="bg-[#3e0f0f] text-white p-6 rounded-lg shadow mb-8 flex justify-between items-center">
            <div>
              <span className="text-xs uppercase font-bold text-red-200 tracking-wider">Class Advisory</span>
              <h2 className="text-2xl font-bold">{section.grade_level} - {section.name}</h2>
            </div>
            <div className="text-right">
              <span className="block text-xs uppercase font-bold text-red-200 tracking-wider">School Year</span>
              <span className="font-semibold text-lg">{schoolYear}</span>
            </div>
          </div>

          {/* Roster Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#5D1919] text-white text-sm font-bold uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">LRN</th>
                  <th className="p-4">Student Name</th>
                  <th className="p-4 text-center">Gender</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 italic">No students enrolled in this section yet.</td>
                  </tr>
                ) : (
                  students.map((student, idx) => (
                    <tr key={student.enrollment_id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-4 text-center text-gray-500 font-bold">{idx + 1}</td>
                      <td className="p-4 font-mono text-sm text-gray-700">{student.lrn}</td>
                      <td className="p-4 font-semibold text-gray-800">{student.last_name}, {student.first_name} {student.middle_name || ""}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${student.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
                          {student.gender}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleViewReportCard(student)}
                          className="bg-[#5D1919] hover:bg-[#3e0f0f] text-white text-xs font-bold py-2 px-4 rounded transition shadow-sm"
                        >
                          View Report Card (SF9)
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* REPORT CARD MODAL */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 border-t-8 border-[#5D1919]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b pb-4 mb-6">
              <div>
                <span className="text-xs font-bold text-red-700 uppercase tracking-widest">DepEd Form 138-A</span>
                <h2 className="text-2xl font-bold text-gray-800">Learner's Progress Report Card</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* SF9 Header Detail Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 text-sm text-gray-700">
              <div><span className="block text-xs text-gray-400 uppercase font-bold">Name</span><strong>{selectedStudent.last_name}, {selectedStudent.first_name}</strong></div>
              <div><span className="block text-xs text-gray-400 uppercase font-bold">LRN</span><strong className="font-mono">{selectedStudent.lrn}</strong></div>
              <div><span className="block text-xs text-gray-400 uppercase font-bold">Grade & Section</span><strong>{section.grade_level} - {section.name}</strong></div>
              <div><span className="block text-xs text-gray-400 uppercase font-bold">School Year</span><strong>{schoolYear}</strong></div>
            </div>

            {/* Grades Report Table */}
            <table className="w-full text-center border-collapse border border-gray-300">
              <thead>
                <tr className="bg-[#5D1919] text-white text-xs font-bold uppercase tracking-wider">
                  <th className="p-3 border border-gray-300 text-left">Learning Areas (Subjects)</th>
                  <th className="p-3 border border-gray-300 w-24">1st Tri</th>
                  <th className="p-3 border border-gray-300 w-24">2nd Tri</th>
                  <th className="p-3 border border-gray-300 w-24">3rd Tri</th>
                  <th className="p-3 border border-gray-300 w-28">Final Grade</th>
                  <th className="p-3 border border-gray-300 w-28">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(getStudentCardData(selectedStudent.enrollment_id)).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">No grade records found for this student.</td>
                  </tr>
                ) : (
                  Object.entries(getStudentCardData(selectedStudent.enrollment_id)).map(([subjectName, trimesters]) => {
                    const gradesArray = [trimesters.tri1, trimesters.tri2, trimesters.tri3].filter(g => g !== null) as number[];
                    const finalGrade = gradesArray.length > 0 ? Math.round(gradesArray.reduce((acc, val) => acc + val, 0) / gradesArray.length) : null;
                    const remarks = finalGrade !== null ? (finalGrade >= 75 ? "PASSED" : "FAILED") : "-";

                    return (
                      <tr key={subjectName} className="hover:bg-gray-50 text-sm">
                        <td className="p-3 border border-gray-300 text-left font-semibold text-gray-800">{subjectName}</td>
                        <td className="p-3 border border-gray-300 text-gray-600">{trimesters.tri1 || "-"}</td>
                        <td className="p-3 border border-gray-300 text-gray-600">{trimesters.tri2 || "-"}</td>
                        <td className="p-3 border border-gray-300 text-gray-600">{trimesters.tri3 || "-"}</td>
                        <td className="p-3 border border-gray-300 font-bold text-gray-900 bg-gray-50">
                          {finalGrade || "-"}
                        </td>
                        <td className={`p-3 border border-gray-300 font-bold ${remarks === 'PASSED' ? 'text-green-600' : remarks === 'FAILED' ? 'text-red-600' : 'text-gray-400'}`}>
                          {remarks}
                        </td>
                      </tr>
                    );
                  })
                )}
                
                {/* General Average Calculation Row */}
                {Object.entries(getStudentCardData(selectedStudent.enrollment_id)).length > 0 && (() => {
                  const data = getStudentCardData(selectedStudent.enrollment_id);
                  let subjectCount = 0;
                  let totalFinalSum = 0;

                  Object.values(data).forEach(t => {
                    const subGrades = [t.tri1, t.tri2, t.tri3].filter(g => g !== null) as number[];
                    if (subGrades.length > 0) {
                      totalFinalSum += Math.round(subGrades.reduce((sum, val) => sum + val, 0) / subGrades.length);
                      subjectCount++;
                    }
                  });

                  const generalAverage = subjectCount > 0 ? Math.round(totalFinalSum / subjectCount) : null;
                  const overallRemarks = generalAverage !== null ? (generalAverage >= 75 ? "PASSED" : "FAILED") : "-";

                  return (
                    <tr className="bg-gray-100 font-bold text-sm">
                      <td className="p-3 border border-gray-300 text-left uppercase tracking-wider">General Average</td>
                      <td colSpan={3} className="border border-gray-300"></td>
                      <td className="p-3 border border-gray-300 text-base text-gray-900 font-extrabold">{generalAverage || "-"}</td>
                      <td className={`p-3 border border-gray-300 text-base font-extrabold ${overallRemarks === 'PASSED' ? 'text-green-700' : overallRemarks === 'FAILED' ? 'text-red-700' : 'text-gray-400'}`}>
                        {overallRemarks}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded transition"
              >
                Close
              </button>
              <button 
                onClick={() => window.print()}
                className="px-6 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded shadow transition"
              >
                Print Report Card
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}