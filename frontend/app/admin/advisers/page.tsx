"use client";

import { apiFetch, notify } from '@/lib/api';
import { useEffect, useState } from "react";

interface SectionAdviser {
  id: number;
  section_name: string;
  grade_level: string;
  first_name: string | null;
  last_name: string | null;
}

export default function AdminAdvisers() {
  const [sections, setSections] = useState<SectionAdviser[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [activeYear, setActiveYear] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionAdviser | null>(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  const fetchAdvisers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch("/api/admin/sections/advisers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSections(data.sections || []);
        setFacultyList(data.faculty || []);
        setActiveYear(data.active_school_year);
      }
    } catch {
      console.error("Failed to fetch advisers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisers();
  }, []);

  const openAssignModal = (section: SectionAdviser) => {
    setSelectedSection(section);
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSection || !selectedFacultyId) return;

    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch("/api/admin/sections/advisers", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          section_id: selectedSection.id,
          faculty_id: selectedFacultyId,
          school_year: activeYear
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsAssignModalOpen(false);
        setSelectedFacultyId("");
        fetchAdvisers(); // Refresh the table
        notify(data.message, 'success');
      } else {
        notify(data.error, 'error');
      }
    } catch {
      notify("Server error.", 'error');
    }
  };

  // --- NEW: Handle Removing an Adviser ---
  const handleRemoveAdviser = async (sectionId: number) => {
    if (!window.confirm("Are you sure you want to remove the current adviser from this section?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch(`/api/admin/sections/advisers/${sectionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      if (res.ok) {
        fetchAdvisers(); // Refresh the table
        notify(data.message, 'success');
      } else {
        notify(data.error, 'error');
      }
    } catch {
      notify("Server error.", 'error');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Homeroom Advisers</h1>
          <p className="text-gray-600 text-sm mt-1">Manage class advisories for S.Y. {activeYear}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="p-4 sm:p-8 text-center text-gray-500">Loading advisory list...</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#3e0f0f] text-white text-sm font-bold uppercase tracking-wider">
                <th className="p-4">Grade Level</th>
                <th className="p-4">Section Name</th>
                <th className="p-4">Current Adviser</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(sec => (
                <tr key={sec.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-4 font-semibold text-gray-800">{sec.grade_level}</td>
                  <td className="p-4 text-gray-600">{sec.section_name}</td>
                  <td className="p-4">
                    {sec.last_name ? (
                      <span className="font-semibold text-green-700">{sec.last_name}, {sec.first_name}</span>
                    ) : (
                      <span className="text-gray-400 italic">No adviser assigned</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => openAssignModal(sec)}
                        className="text-blue-600 hover:text-blue-800 font-semibold px-3 py-1 border border-blue-600 rounded transition"
                      >
                        {sec.last_name ? "Change Adviser" : "Assign Adviser"}
                      </button>
                      
                      {/* --- NEW: Remove Button (Only renders if an adviser exists) --- */}
                      {sec.last_name && (
                        <button 
                          onClick={() => handleRemoveAdviser(sec.id)}
                          className="text-red-600 hover:text-red-800 font-semibold px-3 py-1 border border-red-600 rounded transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ASSIGN MODAL */}
      {isAssignModalOpen && selectedSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Assign Adviser</h2>
            <p className="text-gray-600 text-sm mb-6">
              Setting adviser for <strong>{selectedSection.grade_level} - {selectedSection.section_name}</strong>
            </p>
            
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Select Faculty <span className="text-red-500">*</span></label>
                <select 
                  value={selectedFacultyId}
                  onChange={e => setSelectedFacultyId(e.target.value)}
                  className="w-full border p-2 rounded focus:outline-none focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">-- Choose Faculty --</option>
                  {facultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.last_name}, {f.first_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 font-bold transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-bold transition"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}