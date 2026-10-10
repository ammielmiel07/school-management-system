"use client";

import { apiFetch, notify } from '@/lib/api';
import { useEffect, useState } from "react";
import Link from "next/link";

// --- INTERFACES ---
interface Section {
  grade_level: string;
  section_name?: string;
  name?: string; // Added fallback property in case your backend sends 'name' instead of 'section_name'
}

interface Student {
  enrollment_id: number;
  learner_id: number;
  lrn: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string;
  grades_visible: boolean;
}

interface GradeRecord {
  enrollment_id: number;
  trimester: number;
  transmuted_grade: number;
  subject_name: string;
}

export default function AdvisoryClass() {
  const API_URL = "";

  const [isAdviser, setIsAdviser] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [schoolYear, setSchoolYear] = useState("");
  const [globalActiveTrimester, setGlobalActiveTrimester] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allGrades, setAllGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await apiFetch(`${API_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.settings) {
          setGlobalActiveTrimester(Number(data.settings.active_trisemester));
        }
      } catch {
        console.error("Failed to load global setup settings context.");
      }
    };
    fetchGlobalSettings();
  }, [API_URL]);

  const fetchAdvisoryData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch(`${API_URL}/api/faculty/advisory-class`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setIsAdviser(data.isAdviser);
        if (data.isAdviser) {
          setSection(data.section);
          setSchoolYear(data.school_year);
          const mappedStudents = (data.students || []).map((s: any) => ({
            ...s,
            grades_visible: s.grades_visible || false 
          }));
          setStudents(mappedStudents);
          setAllGrades(data.grades || []);
        }
      }
    } catch {
      console.error("Failed to fetch advisory class.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisoryData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    if (isModalOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const getStudentCardData = (enrollmentId: number) => {
    const studentGrades = allGrades.filter(g => g.enrollment_id === enrollmentId);
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

  const handleToggleVisibility = async (enrollmentId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    setStudents(prev => prev.map(s => 
      s.enrollment_id === enrollmentId ? { ...s, grades_visible: newStatus } : s
    ));
    
    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch(`${API_URL}/api/faculty/advisory-class/visibility/${enrollmentId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ isVisible: newStatus })
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }
    } catch (err) {
      console.error("Caught an error. Reverting UI.", err);
      setStudents(prev => prev.map(s => 
        s.enrollment_id === enrollmentId ? { ...s, grades_visible: currentStatus } : s
      ));
    }
  };

  const handleDownloadSF1 = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch(`${API_URL}/api/faculty/advisory-class/sf1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to generate file");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Using fallback for section name
      a.download = `SF1_${section?.section_name || section?.name || "Section"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      notify("Could not download SF1. Please try again or contact the school administrator.", 'error');
    }
  };

  const handleDownloadSF2 = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch(`${API_URL}/api/faculty/advisory-class/sf2`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to generate file");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Using fallback for section name
      a.download = `SF2_${section?.section_name || section?.name || "Section"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      notify("Error downloading SF2.", 'error');
    }
  };

  const maleStudents = students
    .filter(s => s.gender === 'Male')
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
    
  const femaleStudents = students
    .filter(s => s.gender === 'Female')
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  const renderStudentTable = (studentList: Student[], title: string, isMale: boolean) => (
    <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
      <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center gap-2">
        <span className={isMale ? "text-blue-500" : "text-pink-500"}>
          {isMale ? "♂" : "♀"}
        </span>
        <h3 className="font-bold text-gray-800">{title}</h3>
      </div>
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-[#3e0f0f] text-white uppercase tracking-wider text-xs">
            <th className="p-3 w-10 text-center">#</th>
            <th className="p-3 w-28">LRN</th>
            <th className="p-3">Name</th>
            <th className="p-3 text-center w-24">Visibility</th>
            <th className="p-3 text-center w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {studentList.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-gray-500 italic">No {title.toLowerCase()} students.</td>
            </tr>
          ) : (
            studentList.map((student, idx) => {
              // Constructing the string safely to avoid 'undefined'
              const secName = section?.section_name || section?.name || "Unnamed Section";
              const formattedSectionString = `${section?.grade_level} - ${secName}`;

              return (
                <tr key={student.enrollment_id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="p-3 text-center text-gray-500 font-bold">{idx + 1}</td>
                  <td className="p-3 font-mono text-gray-600 text-xs">{student.lrn}</td>
                  <td className="p-3 font-semibold text-gray-800">
                    {student.last_name}, {student.first_name}
                    <button 
                      onClick={() => handleViewReportCard(student)}
                      className="ml-2 text-gray-400 hover:text-[#5D1919] transition"
                      title="View SF9 Report Card"
                    >
                      📄
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${student.grades_visible ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {student.grades_visible ? "Visible" : "Hidden"}
                    </span>
                  </td>
                  <td className="p-3 text-center flex flex-col gap-1">
                    <button 
                      onClick={() => handleToggleVisibility(student.enrollment_id, student.grades_visible)}
                      className={`text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1 w-full transition shadow-sm ${student.grades_visible ? 'text-gray-600 bg-gray-100 hover:bg-gray-200' : 'text-[#5D1919] bg-red-50 hover:bg-red-100 border border-red-100'}`}
                    >
                      {student.grades_visible ? " Hide Grades" : " Show Grades"}
                    </button>

                    {/* Updated Link passing the safe formattedSectionString */}
                    <Link 
                      href={`/faculty/observed-values?learnerId=${student.learner_id}&studentName=${encodeURIComponent(`${student.last_name}, ${student.first_name}`)}&sectionName=${encodeURIComponent(formattedSectionString)}`}
                      className="text-xs font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1 w-full transition shadow-sm text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-100"
                    >
                      ⭐ Values
                    </Link>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const currentStudentGrades = selectedStudent ? getStudentCardData(selectedStudent.enrollment_id) : {};
  const displaySectionName = section?.section_name || section?.name || "Unnamed Section";

  return (
    <div className="p-4 sm:p-8 max-w-[90rem] mx-auto">
      <div className="mb-6 border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            👥 Advisory Section
          </h1>
        </div>
      </div>

      {loading ? (
        <p className="p-4 sm:p-8 text-center text-gray-500 italic">Loading advisory roster...</p>
      ) : !isAdviser || !section ? (
        <div className="bg-white p-12 rounded-lg shadow-sm border text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Section Assigned</h2>
          <p className="text-gray-500">You are not designated as an Adviser for any class section in S.Y. {schoolYear}.</p>
        </div>
      ) : (
        <>
          {/* Header Controls */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#5D1919]">
                {section.grade_level} - {displaySectionName}
              </h2>
              <p className="text-sm text-gray-500 font-medium">School Year: {schoolYear} | Trimester {globalActiveTrimester}</p>
            </div>
                
            <div className="flex gap-2 flex-wrap">
              <Link href="/faculty/attendance" className="bg-[#5D1919] text-white hover:bg-[#3e0f0f] text-sm font-bold py-2 px-4 rounded transition flex items-center gap-2 shadow-sm">
                📅 Monthly Attendance
              </Link>
                
              <div className="h-9 w-px bg-gray-300 mx-1 hidden sm:block"></div>
                
              <button onClick={handleDownloadSF1} className="bg-white border border-green-600 text-green-700 hover:bg-green-50 text-sm font-bold py-2 px-4 rounded transition flex items-center gap-2 shadow-sm">
                📗 SF1
              </button>
              <button onClick={handleDownloadSF2} className="bg-white border border-green-600 text-green-700 hover:bg-green-50 text-sm font-bold py-2 px-4 rounded transition flex items-center gap-2 shadow-sm">
                📘 SF2
              </button>
              <button onClick={() => window.print()} className="bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm font-bold py-2 px-4 rounded transition flex items-center gap-2 shadow-sm">
                🖨️ Print List
              </button>
            </div>
          </div>

          {/* Split Tables Container */}
          <div className="flex flex-col xl:flex-row gap-6">
            {renderStudentTable(maleStudents, "Male", true)}
            {renderStudentTable(femaleStudents, "Female", false)}
          </div>
        </>
      )}

      {/* Report Card Modal */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 border-t-8 border-[#5D1919]">
            
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 text-sm text-gray-700">
              <div><span className="block text-xs text-gray-400 uppercase font-bold">Name</span><strong>{selectedStudent.last_name}, {selectedStudent.first_name}</strong></div>
              <div><span className="block text-xs text-gray-400 uppercase font-bold">LRN</span><strong className="font-mono">{selectedStudent.lrn}</strong></div>
              <div><span className="block text-xs text-gray-400 uppercase font-bold">Grade & Section</span><strong>{section?.grade_level} - {displaySectionName}</strong></div>
              <div><span className="block text-xs text-gray-400 uppercase font-bold">School Year</span><strong>{schoolYear}</strong></div>
            </div>

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
                {Object.entries(currentStudentGrades).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 sm:p-8 text-center text-gray-400 italic">No grade records found for this student.</td>
                  </tr>
                ) : (
                  Object.entries(currentStudentGrades).map(([subjectName, trimesters]) => {
                    const gradesArray = [trimesters.tri1, trimesters.tri2, trimesters.tri3].filter(g => g !== null) as number[];
                    const finalGrade = gradesArray.length > 0 ? Math.round(gradesArray.reduce((acc, val) => acc + val, 0) / gradesArray.length) : null;
                    const remarks = finalGrade !== null ? (finalGrade >= 75 ? "PASSED" : "FAILED") : "-";

                    return (
                      <tr key={subjectName} className="hover:bg-gray-50 text-sm">
                        <td className="p-3 border border-gray-300 text-left font-semibold text-gray-800">{subjectName}</td>
                        <td className="p-3 border border-gray-300 text-gray-600">{trimesters.tri1 || "-"}</td>
                        <td className="p-3 border border-gray-300 text-gray-600">{trimesters.tri2 || "-"}</td>
                        <td className="p-3 border border-gray-300 text-gray-600">{trimesters.tri3 || "-"}</td>
                        <td className="p-3 border border-gray-300 font-bold text-gray-800 bg-gray-50">{finalGrade || "-"}</td>
                        <td className={`p-3 border border-gray-300 font-bold text-xs ${remarks === "PASSED" ? "text-green-700" : remarks === "FAILED" ? "text-red-700" : "text-gray-400"}`}>{remarks}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}