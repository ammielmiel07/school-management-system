"use client";

import { useEffect, useState } from "react";

interface Subject {
  id: number;
  subject_name: string;
  ww_weight: number;
  pt_weight: number;
  ex_weight: number;
}

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({ subject_name: "", ww_weight: "", pt_weight: "", ex_weight: "" });

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/subjects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSubjects(data.subjects || data);
    } catch (err) {
      console.error("Failed to fetch subjects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Handle Add Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/admin/subjects", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(newSubject),
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewSubject({ subject_name: "", ww_weight: "", pt_weight: "", ex_weight: "" });
        fetchSubjects();
      } else {
        alert("Failed to add subject");
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  // Handle Edit Submit
  const openEditModal = (subject: Subject) => {
    setEditSubject(subject);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubject) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/subjects/${editSubject.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(editSubject),
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchSubjects();
        alert(data.message || "Subject updated!");
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  // Handle Delete
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/admin/subjects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      
      if (res.ok) {
        fetchSubjects();
        alert(data.message || "Subject deleted!");
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
        <h1 className="text-3xl font-bold text-gray-800">Manage Subjects</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-green-700 text-white px-4 py-2 rounded shadow hover:bg-green-800 font-bold"
        >
          + Add Subject
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading subjects...</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#3e0f0f] text-white text-sm font-bold uppercase tracking-wider">
                <th className="p-4">Subject Name</th>
                <th className="p-4 text-center">WW Weight</th>
                <th className="p-4 text-center">PT Weight</th>
                <th className="p-4 text-center">EX Weight</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(sub => (
                <tr key={sub.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-4 font-semibold text-gray-800">{sub.subject_name}</td>
                  <td className="p-4 text-center text-gray-600">{sub.ww_weight}%</td>
                  <td className="p-4 text-center text-gray-600">{sub.pt_weight}%</td>
                  <td className="p-4 text-center text-gray-600">{sub.ex_weight}%</td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => openEditModal(sub)}
                      className="text-blue-600 hover:text-blue-800 font-semibold mr-4 px-2 py-1 border border-blue-600 rounded"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(sub.id)}
                      className="text-red-600 hover:text-red-800 font-semibold px-2 py-1 border border-red-600 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Add New Subject</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Subject Name</label>
                <input 
                  type="text" required placeholder="e.g., Mathematics"
                  value={newSubject.subject_name} 
                  onChange={e => setNewSubject({...newSubject, subject_name: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">WW (%)</label>
                  <input 
                    type="number" required placeholder="40"
                    value={newSubject.ww_weight} 
                    onChange={e => setNewSubject({...newSubject, ww_weight: e.target.value})}
                    className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">PT (%)</label>
                  <input 
                    type="number" required placeholder="40"
                    value={newSubject.pt_weight} 
                    onChange={e => setNewSubject({...newSubject, pt_weight: e.target.value})}
                    className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">EX (%)</label>
                  <input 
                    type="number" required placeholder="20"
                    value={newSubject.ex_weight} 
                    onChange={e => setNewSubject({...newSubject, ex_weight: e.target.value})}
                    className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                  />
                </div>
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
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && editSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Edit Subject</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Subject Name</label>
                <input 
                  type="text" required 
                  value={editSubject.subject_name} 
                  onChange={e => setEditSubject({...editSubject, subject_name: e.target.value})}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">WW (%)</label>
                  <input 
                    type="number" required 
                    value={editSubject.ww_weight} 
                    onChange={e => setEditSubject({...editSubject, ww_weight: Number(e.target.value)})}
                    className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">PT (%)</label>
                  <input 
                    type="number" required 
                    value={editSubject.pt_weight} 
                    onChange={e => setEditSubject({...editSubject, pt_weight: Number(e.target.value)})}
                    className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">EX (%)</label>
                  <input 
                    type="number" required 
                    value={editSubject.ex_weight} 
                    onChange={e => setEditSubject({...editSubject, ex_weight: Number(e.target.value)})}
                    className="w-full border p-2 rounded focus:outline-none focus:border-blue-500" 
                  />
                </div>
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