"use client";

import { useEffect, useState } from "react";

export default function AdminEnrollments() {
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<any>(null);
  
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [enrolled, setEnrolled] = useState<any[]>([]);
  const [activeYear, setActiveYear] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch all sections when page loads
  useEffect(() => {
    const fetchSections = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/sections", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSections(data.sections || []);
    };
    fetchSections();
  }, []);

  // When a section is selected, fetch the dual-pane data
  const handleSectionSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const secId = e.target.value;
    if (!secId) {
      setSelectedSection(null);
      setUnassigned([]);
      setEnrolled([]);
      return;
    }

    const sec = sections.find(s => s.id.toString() === secId);
    setSelectedSection(sec);
    fetchClassData(sec.id, sec.grade_level);
  };

  const fetchClassData = async (sectionId: number, gradeLevel: string) => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      // 1. Fetch Unassigned Learners for this Grade Level
      const unassignedRes = await fetch(`http://localhost:5000/api/admin/enrollments/unassigned?grade_level=${gradeLevel}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const unassignedData = await unassignedRes.json();
      
      // 2. Fetch Currently Enrolled Learners in this Section
      const enrolledRes = await fetch(`http://localhost:5000/api/admin/enrollments/section/${sectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const enrolledData = await enrolledRes.json();

      if (unassignedRes.ok && enrolledRes.ok) {
        setUnassigned(unassignedData.learners || []);
        setEnrolled(enrolledData.enrolled || []);
        setActiveYear(unassignedData.activeYear);
      }
    } catch (err) {
      console.error("Failed to load section data.");
    } finally {
      setLoading(false);
    }
  };

  // Move student from Unassigned (Left) to Enrolled (Right)
  const enrollStudent = async (learnerId: number) => {
    if (!selectedSection) return;
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch("http://localhost:5000/api/admin/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ learner_id: learnerId, section_id: selectedSection.id })
      });
      
      if (res.ok) {
        // Refresh the lists seamlessly
        fetchClassData(selectedSection.id, selectedSection.grade_level);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Server error during enrollment.");
    }
  };

  // Move student from Enrolled (Right) back to Unassigned (Left)
  const unenrollStudent = async (enrollmentId: number) => {
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch(`http://localhost:5000/api/admin/enrollments/${enrollmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchClassData(selectedSection.id, selectedSection.grade_level);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Server error during unenrollment.");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Student Sectioning</h1>
        <p className="text-gray-600 mt-1">Assign admitted learners to their specific classroom sections.</p>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-6 rounded-lg shadow border-t-4 border-[#3e0f0f] mb-8 flex items-center justify-between">
        <div className="w-1/2">
          <label className="block text-sm font-bold text-gray-700 mb-2">Select a Section to Manage:</label>
          <select 
            onChange={handleSectionSelect} 
            className="w-full border border-gray-300 p-3 rounded font-semibold text-gray-800 focus:outline-none focus:border-red-900 bg-gray-50"
          >
            <option value="">-- Choose a Section --</option>
            {sections.map(sec => (
              <option key={sec.id} value={sec.id}>{sec.grade_level} - {sec.section_name}</option>
            ))}
          </select>
        </div>
        {activeYear && (
          <div className="text-right">
            <span className="block text-xs uppercase font-bold text-gray-500 tracking-wider">Active School Year</span>
            <span className="text-xl font-bold text-green-700 bg-green-50 px-4 py-1 rounded">{activeYear}</span>
          </div>
        )}
      </div>

      {/* Dual Pane Interface */}
      {selectedSection && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* LEFT PANE: Unassigned */}
          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[600px]">
            <div className="bg-gray-100 p-4 border-b">
              <h2 className="font-bold text-gray-800">Unassigned {selectedSection.grade_level} Learners</h2>
              <p className="text-xs text-gray-500">Students waiting for a section</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {loading ? <p className="text-center text-gray-400 mt-4">Loading...</p> : null}
              {!loading && unassigned.length === 0 ? (
                <p className="text-center text-gray-400 mt-4 italic">No unassigned students found.</p>
              ) : (
                <ul className="space-y-2">
                  {unassigned.map(student => (
                    <li key={student.id} className="border p-3 rounded flex justify-between items-center hover:border-green-500 transition">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{student.last_name}, {student.first_name}</p>
                        <p className="text-xs text-gray-500">LRN: {student.lrn}</p>
                      </div>
                      <button 
                        onClick={() => enrollStudent(student.id)}
                        className="bg-green-100 text-green-800 font-bold px-4 py-1 rounded text-sm hover:bg-green-200 transition"
                      >
                        Enroll ➔
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Enrolled */}
          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[600px] border-2 border-green-100">
            <div className="bg-green-50 p-4 border-b border-green-200 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-green-900">{selectedSection.grade_level} - {selectedSection.section_name}</h2>
                <p className="text-xs text-green-700">Official Class Roster</p>
              </div>
              <span className="bg-green-200 text-green-900 font-bold px-3 py-1 rounded-full text-xs">
                {enrolled.length} Students
              </span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {loading ? <p className="text-center text-gray-400 mt-4">Loading...</p> : null}
              {!loading && enrolled.length === 0 ? (
                <p className="text-center text-gray-400 mt-4 italic">This section is currently empty.</p>
              ) : (
                <ul className="space-y-2">
                  {enrolled.map(student => (
                    <li key={student.enrollment_id} className="border p-3 rounded flex justify-between items-center bg-gray-50">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{student.last_name}, {student.first_name}</p>
                        <p className="text-xs text-gray-500">LRN: {student.lrn} | {student.gender}</p>
                      </div>
                      <button 
                        onClick={() => unenrollStudent(student.enrollment_id)}
                        className="text-red-500 font-bold px-2 py-1 rounded text-xs hover:bg-red-50 transition border border-transparent hover:border-red-200"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}