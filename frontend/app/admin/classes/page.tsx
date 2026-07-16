"use client";

import { useState, useEffect } from "react";

interface Section { id: number; section_name: string; grade_level: number; first_name: string | null; last_name: string | null; }
interface Faculty { id: number; first_name: string; last_name: string; employee_no: string; }

export default function ManageClasses() {
  const [sections, setSections] = useState<Section[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [schoolYear, setSchoolYear] = useState("Loading...");

  // Add Section State
  const [sectionName, setSectionName] = useState("");
  const [gradeLevel, setGradeLevel] = useState<number | "">("");
  
  // Assign Adviser State
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchPageData = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/admin/sections/advisers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setSections(data.sections);
        setFacultyList(data.faculty);
        setSchoolYear(data.active_school_year);
      }
    } catch (err) {
      setError("Failed to load page data.");
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); setError("");
    const token = localStorage.getItem("token");

    try {
      const response = await fetch("http://localhost:5000/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section_name: sectionName, grade_level: gradeLevel }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        setSectionName(""); setGradeLevel("");
        fetchPageData(); 
      } else {
        setError(data.error || "Failed to add section.");
      }
    } catch (err) {
      setError("Server connection error.");
    }
  };

  const handleAssignAdviser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); setError("");
    const token = localStorage.getItem("token");

    try {
      const response = await fetch("http://localhost:5000/api/admin/sections/advisers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section_id: selectedSection, faculty_id: selectedFaculty, school_year: schoolYear }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        setSelectedSection(""); setSelectedFaculty("");
        fetchPageData(); 
      } else {
        setError(data.error || "Failed to assign adviser.");
      }
    } catch (err) {
      setError("Server connection error.");
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">Manage Classes & Advisers</h1>

        {message && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded shadow-sm">
            <p className="text-green-700 font-semibold">{message}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded shadow-sm">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Side: Forms Container */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Form 1: Add Section */}
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h2 className="text-xl font-bold text-gray-700 mb-4">1. Create Section</h2>
              <form onSubmit={handleAddSection} className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">Grade Level</label>
                  <input type="number" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value ? Number(e.target.value) : "")} placeholder="e.g., 7" className="w-full px-3 py-2 text-black bg-white border border-gray-300 rounded focus:outline-none focus:border-red-900" required min="1" max="12"/>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">Section Name</label>
                  <input type="text" value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="e.g., Rizal" className="w-full px-3 py-2 text-black bg-white border border-gray-300 rounded focus:outline-none focus:border-red-900" required />
                </div>
                <button type="submit" className="w-full bg-red-900 text-white font-bold py-2 px-4 rounded hover:bg-red-800 transition duration-200">
                  Create Section
                </button>
              </form>
            </div>

            {/* Form 2: Assign Adviser */}
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h2 className="text-xl font-bold text-gray-700 mb-2">2. Assign Adviser</h2>
              <p className="text-xs text-gray-500 mb-4">For active year: <strong>{schoolYear}</strong></p>
              <form onSubmit={handleAssignAdviser} className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">Select Section</label>
                  <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="w-full px-3 py-2 text-black bg-white border border-gray-300 rounded focus:outline-none focus:border-red-900" required>
                    <option value="">-- Choose Section --</option>
                    {sections.map(s => <option key={s.id} value={s.id}>Grade {s.grade_level} - {s.section_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">Select Teacher</label>
                  <select value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)} className="w-full px-3 py-2 text-black bg-white border border-gray-300 rounded focus:outline-none focus:border-red-900" required>
                    <option value="">-- Choose Faculty --</option>
                    {facultyList.map(f => <option key={f.id} value={f.id}>{f.last_name}, {f.first_name}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-green-700 text-white font-bold py-2 px-4 rounded hover:bg-green-800 transition duration-200">
                  Assign Adviser
                </button>
              </form>
            </div>

          </div>

          {/* Right Side: Upgraded List of Sections */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h2 className="text-xl font-bold text-gray-700 mb-4">Current Masterlist ({schoolYear})</h2>
              
              {sections.length === 0 ? (
                <p className="text-gray-500 italic">No sections have been added yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-200">
                        <th className="p-3 font-bold w-1/4">Grade Level</th>
                        <th className="p-3 font-bold w-1/3">Section Name</th>
                        <th className="p-3 font-bold">Current Adviser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((section) => (
                        <tr key={section.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="p-3 text-gray-800">Grade {section.grade_level}</td>
                          <td className="p-3 text-gray-800 font-semibold">{section.section_name}</td>
                          <td className="p-3">
                            {section.last_name ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                {section.first_name} {section.last_name}
                              </span>
                            ) : (
                              <span className="text-red-500 italic text-sm">No Adviser Assigned</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}