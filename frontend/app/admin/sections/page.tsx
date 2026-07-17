"use client";

import { useEffect, useState } from "react";

interface Section {
  id: number;
  section_name: string;
  grade_level: string;
  is_star_section: boolean; // Added property
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
        alert("Failed to add section");
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

  return (
    <div className="p-8 max-w-5xl mx-auto">
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
                    <td className="p-4 font-semibold text-gray-800">{sec.grade_level}</td>
                    <td className="p-4 text-gray-600 flex items-center gap-2">
                      {sec.section_name}
                      {sec.is_star_section && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded border border-yellow-200">
                          ⭐ Star Section
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => openEditModal(sec)}
                        className="text-blue-600 hover:text-blue-800 font-semibold mr-4 px-2 py-1 border border-blue-600 rounded"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(sec.id)}
                        className="text-red-600 hover:text-red-800 font-semibold px-2 py-1 border border-red-600 rounded"
                      >
                        Delete
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