"use client";

import { useEffect, useState } from "react";

interface Section {
  id: number;
  section_name: string;
  grade_level: string;
  is_star_section: boolean;
}

interface EnrolledStudent {
  enrollment_id: number;
  learner_id: number;
  lrn: string;
  first_name: string;
  last_name: string;
  gender: string;
}

export default function AdminSections() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSection, setNewSection] = useState({ section_name: "", grade_level: "", is_star_section: false });

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSection, setEditSection] = useState<Section | null>(null);

  // View Students State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSection, setViewingSection] = useState<Section | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const fetchSections = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/sections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSections(data.sections || data);
    } catch (err) {
      console.error("Failed to fetch sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  // Handle Add Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/admin/sections", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(newSection),
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewSection({ section_name: "", grade_level: "", is_star_section: false });
        fetchSections();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add section");
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  // Handle Edit Submit
  const openEditModal = (section: Section) => {
    setEditSection(section);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSection) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/sections/${editSection.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(editSection),
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchSections();
        alert(data.message || "Section updated!");
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  // Handle Delete
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this section?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/sections/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      
      if (res.ok) {
        fetchSections();
        alert(data.message || "Section deleted!");
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  // Handle View Students
  const openViewModal = async (section: Section) => {
    setViewingSection(section);
    setIsViewModalOpen(true);
    setStudentsLoading(true);
    setEnrolledStudents([]);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/admin/enrollments/section/${section.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEnrolledStudents(data.enrolled || []);
      } else {
        alert(data.error || "Failed to load students.");
      }
    } catch (err) {
      console.error("Failed to fetch students");
      alert("Server error while fetching students.");
    } finally {
      setStudentsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Manage Sections</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-green-700 text-white px-4 py-2 rounded shadow hover:bg-green-800 font-bold"
        >
          + Add Section
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading sections...</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#3e0f0f] text-white text-sm font-bold uppercase tracking-wider">
                <th className="p-4">Grade Level</th>
                <th className="p-4">Section Name</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500 italic">No sections found. Add one to get started.</td>
                </tr>
              ) : (
                sections.map(sec => (
                  <tr key={sec.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-800">Grade {sec.grade_level}</td>
                    <td className="p-4 text-gray-600 flex items-center gap-2">
                      {sec.section_name}
                      {sec.is_star_section && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded border border-yellow-200">
                          ⭐ Star Section
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openViewModal(sec)}
                          className="text-green-700 hover:text-green-900 font-semibold px-3 py-1 border border-green-700 rounded transition"
                        >
                          View Students
                        </button>
                        <button 
                          onClick={() => openEditModal(sec)}
                          className="text-blue-600 hover:text-blue-800 font-semibold px-3 py-1 border border-blue-600 rounded transition"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(sec.id)}
                          className="text-red-600 hover:text-red-800 font-semibold px-3 py-1 border border-red-600 rounded transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* VIEW STUDENTS MODAL */}
      {isViewModalOpen && viewingSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {viewingSection.section_name} 
                  {viewingSection.is_star_section && <span className="ml-2 text-lg">⭐</span>}
                </h2>
                <p className="text-sm text-gray-500 font-semibold mt-1">Grade {viewingSection.grade_level} Roster</p>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-500 hover:text-gray-800 font-bold text-2xl">&times;</button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1 bg-gray-50">
              {studentsLoading ? (
                <p className="p-8 text-center text-gray-500">Loading student roster...</p>
              ) : enrolledStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-gray-500 text-lg">No students are currently enrolled in this section.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-sm font-bold uppercase tracking-wider border-b border-gray-200">
                      <th className="p-4">LRN</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Gender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolledStudents.map((student, idx) => (
                      <tr key={student.enrollment_id} className={`border-b border-gray-100 hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="p-4 text-gray-600 font-mono text-sm">{student.lrn}</td>
                        <td className="p-4 font-semibold text-gray-800">
                          {student.last_name}, {student.first_name}
                        </td>
                        <td className="p-4 text-gray-600">
                          <span className={`px-2 py-1 text-xs font-bold rounded ${student.gender === 'Male' ? 'bg-blue-100 text-blue-800' : student.gender === 'Female' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'}`}>
                            {student.gender}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end shrink-0">
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2 bg-gray-800 text-white rounded font-bold hover:bg-gray-900 transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Add New Section</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Grade Level</label>
                <select 
                  required 
                  value={newSection.grade_level} 
                  onChange={e => setNewSection({...newSection, grade_level: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500 bg-white" 
                >
                  <option value="" disabled>Select Grade Level</option>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Section Name</label>
                <input 
                  type="text" required placeholder="e.g., Rizal"
                  value={newSection.section_name} 
                  onChange={e => setNewSection({...newSection, section_name: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                />
              </div>
              
              <div className="flex items-center mt-2">
                <input 
                  type="checkbox" 
                  id="add-star-section"
                  checked={newSection.is_star_section}
                  onChange={e => setNewSection({...newSection, is_star_section: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="add-star-section" className="ml-2 block text-sm font-bold text-gray-700">
                  Designate as Star Section
                </label>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 font-bold"
                >
                  Save Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && editSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Edit Section</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Grade Level</label>
                <select 
                  required 
                  value={editSection.grade_level} 
                  onChange={e => setEditSection({...editSection, grade_level: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500 bg-white" 
                >
                  <option value="" disabled>Select Grade Level</option>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Section Name</label>
                <input 
                  type="text" required 
                  value={editSection.section_name} 
                  onChange={e => setEditSection({...editSection, section_name: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                />
              </div>

              <div className="flex items-center mt-2">
                <input 
                  type="checkbox" 
                  id="edit-star-section"
                  checked={editSection.is_star_section}
                  onChange={e => setEditSection({...editSection, is_star_section: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="edit-star-section" className="ml-2 block text-sm font-bold text-gray-700">
                  Designate as Star Section
                </label>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-[#3e0f0f] text-white rounded hover:bg-red-900 font-bold"
                >
                  Update Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}