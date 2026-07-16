"use client";

import { useEffect, useState } from "react";

interface FacultyLoad {
  id: number;
  first_name: string;
  last_name: string;
  subject_name: string;
  section_name: string;
  grade_level: string;
}

export default function AdminFacultyLoads() {
  const [loads, setLoads] = useState<FacultyLoad[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form Data (Dropdowns)
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [subjectList, setSubjectList] = useState<any[]>([]);
  const [sectionList, setSectionList] = useState<any[]>([]);
  const [activeYear, setActiveYear] = useState("");

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLoad, setNewLoad] = useState({ faculty_id: "", subject_id: "", section_id: "" });

  const fetchLoads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/faculty-loads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setLoads(data.loads || []);
    } catch (err) {
      console.error("Failed to fetch loads");
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/faculty-loads/form-data", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setFacultyList(data.faculty);
        setSubjectList(data.subjects);
        setSectionList(data.sections);
        setActiveYear(data.active_school_year);
      }
    } catch (err) {
      console.error("Failed to fetch form data");
    }
  };

  useEffect(() => {
    fetchLoads();
    fetchFormData();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoad.faculty_id || !newLoad.subject_id || !newLoad.section_id) {
      alert("Please select a Faculty, Subject, and Section.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/faculty-loads", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...newLoad, school_year: activeYear }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewLoad({ faculty_id: "", subject_id: "", section_id: "" });
        fetchLoads();
        alert(data.message);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this teaching assignment?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/faculty-loads/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      
      if (res.ok) {
        fetchLoads();
        alert(data.message);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Faculty Loads</h1>
          <p className="text-gray-600 text-sm mt-1">Assign teachers to their subjects and sections for S.Y. {activeYear}</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-green-700 text-white px-4 py-2 rounded shadow hover:bg-green-800 font-bold"
        >
          + Assign Load
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading assignments...</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#3e0f0f] text-white text-sm font-bold uppercase tracking-wider">
                <th className="p-4">Faculty Name</th>
                <th className="p-4">Subject</th>
                <th className="p-4">Grade & Section</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 italic">No faculty loads assigned for this school year.</td>
                </tr>
              ) : (
                loads.map(load => (
                  <tr key={load.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-800">{load.last_name}, {load.first_name}</td>
                    <td className="p-4 text-gray-600">{load.subject_name}</td>
                    <td className="p-4 text-gray-600">{load.grade_level} - {load.section_name}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDelete(load.id)}
                        className="text-red-600 hover:text-red-800 font-semibold px-2 py-1 border border-red-600 rounded transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Assign Teaching Load</h2>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Select Faculty <span className="text-red-500">*</span></label>
                <select 
                  value={newLoad.faculty_id}
                  onChange={e => setNewLoad({...newLoad, faculty_id: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">-- Choose Faculty --</option>
                  {facultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.last_name}, {f.first_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Select Subject <span className="text-red-500">*</span></label>
                <select 
                  value={newLoad.subject_id}
                  onChange={e => setNewLoad({...newLoad, subject_id: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">-- Choose Subject --</option>
                  {subjectList.map(s => (
                    <option key={s.id} value={s.id}>{s.subject_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Select Section <span className="text-red-500">*</span></label>
                <select 
                  value={newLoad.section_id}
                  onChange={e => setNewLoad({...newLoad, section_id: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">-- Choose Section --</option>
                  {sectionList.map(sec => (
                    <option key={sec.id} value={sec.id}>{sec.grade_level} - {sec.section_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 font-bold transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 font-bold transition"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}