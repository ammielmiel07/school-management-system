"use client";

import { apiFetch, notify } from '@/lib/api';
import { useEffect, useState } from "react";

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [activeYear, setActiveYear] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userType, setUserType] = useState("learner");
  
  // Credentials Popup State
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);

  // --- LEARNER STATE (SF1) ---
  const [learnerForm, setLearnerForm] = useState({
    lrn: "", birthdate: "", gender: "", firstName: "", middleName: "", lastName: "", email: "",
    schoolYear: "", gradeLevel: "7", isStarEligible: false,
    motherTongue: "", ip: "", religion: "",
    houseStreet: "", barangay: "", city: "", province: "",
    fatherFirst: "", fatherMiddle: "", fatherLast: "",
    motherFirst: "", motherMiddle: "", motherLast: "",
    guardianName: "", guardianRelation: "", contactNumber: ""
  });

  // --- NEW FACULTY STATE ---
  const [facultyForm, setFacultyForm] = useState({
    employeeNo: "", firstName: "", middleName: "", lastName: "", 
    startSchoolYear: "",
    email: "", contactNumber: ""
  });

  const fetchAccounts = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch("/api/admin/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts || []);
      else setLoadError(data.error || 'Could not load accounts.');
    } catch {
      setLoadError('Could not load accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    apiFetch('/api/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(async res => {
        const data = await res.json();
        if (!res.ok || !data.settings) return;
        const year = data.settings.current_school_year;
        setActiveYear(year);
        setLearnerForm(form => ({ ...form, schoolYear: year }));
        setFacultyForm(form => ({ ...form, startSchoolYear: year }));
      }).catch(() => {});
  }, []);

  const handleCreateLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!/^\d{12}$/.test(learnerForm.lrn)) return notify("LRN must be exactly 12 digits.", 'error');
    setSaving(true);

    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch("/api/admin/accounts/learner", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(learnerForm),
      });
      
      const data = await res.json();
      if (res.ok) {
        setGeneratedCreds(data.credentials);
        fetchAccounts();
      } else {
        notify(data.error || "Failed to create account.", 'error');
      }
    } catch {
      notify("Server error.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!/^\d{1,7}$/.test(facultyForm.employeeNo)) return notify("Employee Number must contain 1 to 7 digits.", 'error');
    setSaving(true);

    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch("/api/admin/accounts/faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(facultyForm),
      });
      
      const data = await res.json();
      if (res.ok) {
        setGeneratedCreds(data.credentials);
        fetchAccounts();
      } else {
        notify(data.error || "Failed to create account.", 'error');
      }
    } catch {
      notify("Server error.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this account? This will also remove their profile data.")) return;

    try {
      const res = await apiFetch(`/api/admin/accounts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (res.ok) {
        fetchAccounts();
        notify(data.message || "Account deleted!", 'success');
      } else {
        notify(data.error, 'error');
      }
    } catch {
      notify("Server error.", 'error');
    }
  };

  const openEditModal = (acc: any) => {
    setUserType(acc.role);
    setEditingUserId(acc.user_id);
    
    if (acc.role === "learner") {
      setLearnerForm({
        ...learnerForm,
        lrn: acc.lrn || "",
        firstName: acc.first_name || "",
        middleName: acc.middle_name || "",
        lastName: acc.last_name || "",
        email: acc.email || "",
        // Dates from SQL come with timestamps, we split to just get YYYY-MM-DD for the input
        birthdate: acc.birthdate ? acc.birthdate.split('T')[0] : "", 
        gender: acc.gender || "",
        schoolYear: acc.school_year || activeYear,
        gradeLevel: acc.grade_level || "7",
        isStarEligible: acc.is_star_eligible || false,
        motherTongue: acc.mother_tongue || "",
        ip: acc.ethnic_group || "",
        religion: acc.religion || "",
        houseStreet: acc.house_street || "",
        barangay: acc.barangay || "",
        city: acc.city || "",
        province: acc.province || "",
        fatherFirst: acc.father_first || "",
        fatherMiddle: acc.father_middle || "",
        fatherLast: acc.father_last || "",
        motherFirst: acc.mother_first || "",
        motherMiddle: acc.mother_middle || "",
        motherLast: acc.mother_last || "",
        guardianName: acc.guardian_name || "",
        guardianRelation: acc.guardian_relationship || "",
        contactNumber: acc.contact_number || ""
      });
    } else if (acc.role === "faculty") {
      setFacultyForm({
        ...facultyForm,
        employeeNo: acc.employee_no || "",
        firstName: acc.first_name || "",
        middleName: acc.middle_name || "",
        lastName: acc.last_name || "",
        email: acc.email || "",
        startSchoolYear: acc.start_school_year || activeYear,
        contactNumber: acc.contact_number || ""
      });
    }
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = userType === "learner" ? learnerForm : facultyForm;

    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch(`/api/admin/accounts/${editingUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (res.ok) {
        notify("Account updated successfully!", 'success');
        setIsEditModalOpen(false);
        setEditingUserId(null);
        fetchAccounts(); // Refresh the table
      } else {
        notify(data.error || "Failed to update account.", 'error');
      }
    } catch (err) {
      console.error("Full error detail:", err);
      notify('Unable to update the account. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const closeModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false); 
    setEditingUserId(null);   
    setGeneratedCreds(null);
    setLearnerForm({
      lrn: "", birthdate: "", gender: "", firstName: "", middleName: "", lastName: "", email: "",
      schoolYear: activeYear, gradeLevel: "7", isStarEligible: false,
      motherTongue: "", ip: "", religion: "",
      houseStreet: "", barangay: "", city: "", province: "",
      fatherFirst: "", fatherMiddle: "", fatherLast: "", motherFirst: "", motherMiddle: "", motherLast: "",
      guardianName: "", guardianRelation: "", contactNumber: ""
    });
    setFacultyForm({ employeeNo: "", firstName: "", middleName: "", lastName: "", startSchoolYear: activeYear, email: "", contactNumber: "" });
  };

  // Generate dynamic school years based on the current year
  const getDynamicSchoolYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // Generates years from 15 years ago to 5 years in the future
    for (let i = currentYear - 15; i <= currentYear + 5; i++) {
      years.push(`${i}-${i + 1}`);
    }
    return years;
  };
  
  const schoolYearOptions = getDynamicSchoolYears();

  // --- EDIT STATE ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
            Manage Accounts
          </h1>
          <p className="text-gray-600 text-sm mt-1">View, add, and remove system users.</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-green-700 text-white px-4 py-2 rounded shadow hover:bg-green-800 font-bold">
          + Add User
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="p-4 sm:p-8 text-center text-gray-500">Loading accounts...</p>
        ) : loadError ? (
          <div role="alert" className="p-6 text-red-700">{loadError} <button type="button" onClick={fetchAccounts} className="underline font-semibold ml-2">Retry</button></div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#3e0f0f] text-white text-sm font-bold uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Username</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-center">ID / LRN</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 sm:p-8 text-center text-gray-500 italic">No accounts found.</td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.user_id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-4 font-semibold text-gray-800">{acc.last_name}, {acc.first_name}</td>
                    <td className="p-4 text-gray-600">{acc.username}</td>
                    <td className="p-4 text-gray-600 capitalize">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        acc.role === 'faculty' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {acc.role}
                      </span>
                    </td>
                    <td className="p-4 text-center text-gray-600">{acc.identifier}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openEditModal(acc)}
                          className="text-blue-600 hover:text-blue-800 font-semibold px-3 py-1 border border-blue-600 rounded transition"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(acc.user_id)}
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

      {/* ONE-TIME CREDENTIALS POPUP */}
      {generatedCreds && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md text-center border-t-8 border-green-600">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Account Created!</h2>
            <p className="text-gray-600 text-sm mb-6">{generatedCreds.emailSent
              ? <>Temporary credentials were sent to <strong>{generatedCreds.emailSentTo}</strong>.</>
              : <>Email delivery failed. Save these credentials and share them with the account holder.</>}</p>
            
            <div className="bg-gray-50 p-4 rounded text-left space-y-3 mb-6 border border-gray-200">
              <div>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Username</span>
                <p className="font-mono text-lg font-bold text-gray-800">{generatedCreds.learnerUsername}</p>
              </div>
              
              {generatedCreds.parentUsername && (
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Parent Username</span>
                  <p className="font-mono text-lg font-bold text-gray-800">{generatedCreds.parentUsername}</p>
                </div>
              )}
              
              <hr />
              <div>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Temporary Password</span>
                <p className="font-mono text-xl font-bold text-red-600 bg-red-50 p-2 rounded inline-block mt-1">{generatedCreds.learnerPassword || generatedCreds.password}</p>
              </div>
              {generatedCreds.parentPassword && (
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Parent Temporary Password</span>
                  <p className="font-mono text-xl font-bold text-red-600 bg-red-50 p-2 rounded inline-block mt-1">{generatedCreds.parentPassword}</p>
                </div>
              )}
            </div>

            <button onClick={closeModals} className="w-full bg-gray-800 text-white font-bold py-3 rounded hover:bg-gray-900 transition">
              Close & Return to Accounts
            </button>
          </div>
        </div>
      )}

      {/* FIXED UI ADD USER MODAL */}
      {isAddModalOpen && !generatedCreds && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          
          {/* Modal Container: Flex Col, Max Height, Hidden Overflow */}
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* 1. FIXED HEADER */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white shrink-0 z-10 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-800">Add New User</h2>
              <button onClick={closeModals} className="text-gray-500 hover:text-gray-800 font-bold text-2xl">&times;</button>
            </div>

            {/* 2. SCROLLABLE BODY */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
              <div className="mb-6 flex gap-4">
                <button onClick={() => setUserType("learner")} className={`px-6 py-2 rounded font-semibold transition ${userType === "learner" ? "bg-red-900 text-white shadow" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Learner (SF1)</button>
                <button onClick={() => setUserType("faculty")} className={`px-6 py-2 rounded font-semibold transition ${userType === "faculty" ? "bg-red-900 text-white shadow" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Faculty</button>
              </div>

              {/* LEARNER FORM (ID assigned so button outside can trigger it) */}
              {userType === "learner" && (
                <form id="learner-form" onSubmit={handleCreateLearner} className="space-y-4">
                  <fieldset disabled={saving} className="contents">
                  <details className="group border border-gray-300 rounded shadow-sm" open>
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      1. Basic Identification <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">LRN (12 Digits) *</label><input type="text" maxLength={12} required value={learnerForm.lrn} onChange={e => setLearnerForm({...learnerForm, lrn: e.target.value.replace(/\D/g,'')})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Birthdate *</label><input type="date" required value={learnerForm.birthdate} onChange={e => setLearnerForm({...learnerForm, birthdate: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Gender *</label>
                        <select required value={learnerForm.gender} onChange={e => setLearnerForm({...learnerForm, gender: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-red-900">
                          <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option>
                        </select>
                      </div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">First Name *</label><input type="text" required value={learnerForm.firstName} onChange={e => setLearnerForm({...learnerForm, firstName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Middle Name</label><input type="text" value={learnerForm.middleName} onChange={e => setLearnerForm({...learnerForm, middleName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Last Name *</label><input type="text" required value={learnerForm.lastName} onChange={e => setLearnerForm({...learnerForm, lastName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-700 mb-1">Email Address (For Temp Password) *</label><input type="email" required value={learnerForm.email} onChange={e => setLearnerForm({...learnerForm, email: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      2. Enrollment & School Year <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">School Year *</label>
                        <select value={learnerForm.schoolYear} onChange={e => setLearnerForm({...learnerForm, schoolYear: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-red-900">
                          <option value="" disabled>Select School Year</option>
                          {schoolYearOptions.map((sy) => (<option key={sy} value={sy}>{sy}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Grade Level *</label>
                        <select value={learnerForm.gradeLevel} onChange={e => setLearnerForm({...learnerForm, gradeLevel: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-red-900">
                          <option value="7">Grade 7</option><option value="8">Grade 8</option><option value="9">Grade 9</option><option value="10">Grade 10</option>
                        </select>
                      </div>
                      <div className="flex items-center mt-6">
                        <label className="flex items-center space-x-2 cursor-pointer font-bold text-sm text-gray-800">
                          <input type="checkbox" checked={learnerForm.isStarEligible} onChange={e => setLearnerForm({...learnerForm, isStarEligible: e.target.checked})} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                          <span>⭐ Star/Honors Eligible</span>
                        </label>
                      </div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      3. Demographics <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Mother Tongue</label><input type="text" value={learnerForm.motherTongue} onChange={e => setLearnerForm({...learnerForm, motherTongue: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">IP (Ethnic Group)</label><input type="text" value={learnerForm.ip} onChange={e => setLearnerForm({...learnerForm, ip: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Religion</label><input type="text" value={learnerForm.religion} onChange={e => setLearnerForm({...learnerForm, religion: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      4. Address <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">House # / Street / Purok</label><input type="text" value={learnerForm.houseStreet} onChange={e => setLearnerForm({...learnerForm, houseStreet: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Barangay</label><input type="text" value={learnerForm.barangay} onChange={e => setLearnerForm({...learnerForm, barangay: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Municipality / City</label><input type="text" value={learnerForm.city} onChange={e => setLearnerForm({...learnerForm, city: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Province</label><input type="text" value={learnerForm.province} onChange={e => setLearnerForm({...learnerForm, province: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      5. Parents <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 bg-white space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-bold text-blue-800 mb-1">Father's First Name</label><input type="text" value={learnerForm.fatherFirst} onChange={e => setLearnerForm({...learnerForm, fatherFirst: e.target.value})} className="w-full border p-2 rounded bg-blue-50 focus:outline-none focus:border-red-900" /></div>
                        <div><label className="block text-xs font-bold text-blue-800 mb-1">Father's Middle Name</label><input type="text" value={learnerForm.fatherMiddle} onChange={e => setLearnerForm({...learnerForm, fatherMiddle: e.target.value})} className="w-full border p-2 rounded bg-blue-50 focus:outline-none focus:border-red-900" /></div>
                        <div><label className="block text-xs font-bold text-blue-800 mb-1">Father's Last Name</label><input type="text" value={learnerForm.fatherLast} onChange={e => setLearnerForm({...learnerForm, fatherLast: e.target.value})} className="w-full border p-2 rounded bg-blue-50 focus:outline-none focus:border-red-900" /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-bold text-pink-800 mb-1">Mother's First Name</label><input type="text" value={learnerForm.motherFirst} onChange={e => setLearnerForm({...learnerForm, motherFirst: e.target.value})} className="w-full border p-2 rounded bg-pink-50 focus:outline-none focus:border-red-900" /></div>
                        <div><label className="block text-xs font-bold text-pink-800 mb-1">Mother's Maiden Middle</label><input type="text" value={learnerForm.motherMiddle} onChange={e => setLearnerForm({...learnerForm, motherMiddle: e.target.value})} className="w-full border p-2 rounded bg-pink-50 focus:outline-none focus:border-red-900" /></div>
                        <div><label className="block text-xs font-bold text-pink-800 mb-1">Mother's Maiden Last</label><input type="text" value={learnerForm.motherLast} onChange={e => setLearnerForm({...learnerForm, motherLast: e.target.value})} className="w-full border p-2 rounded bg-pink-50 focus:outline-none focus:border-red-900" /></div>
                      </div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      6. Guardian & Contact <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Guardian Name (Optional)</label><input type="text" value={learnerForm.guardianName} onChange={e => setLearnerForm({...learnerForm, guardianName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Relationship</label><input type="text" value={learnerForm.guardianRelation} onChange={e => setLearnerForm({...learnerForm, guardianRelation: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Contact Number *</label><input type="text" required value={learnerForm.contactNumber} onChange={e => setLearnerForm({...learnerForm, contactNumber: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                    </div>
                  </details>
                </fieldset></form>
              )}

              {/* UPGRADED FACULTY FORM (ID assigned so button outside can trigger it) */}
              {userType === "faculty" && (
                <form id="faculty-form" onSubmit={handleCreateFaculty} className="space-y-4">
                  <fieldset disabled={saving} className="contents">
                  <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-4 text-sm text-blue-800">
                    ℹ️ The system will automatically generate a secure password and login credentials for this staff member.
                  </div>
                  
                  <details className="group border border-gray-300 rounded shadow-sm" open>
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      1. Basic Information <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Employee No. (Max 7 Digits) *</label>
                        <input type="text" maxLength={7} required value={facultyForm.employeeNo} onChange={e => setFacultyForm({...facultyForm, employeeNo: e.target.value.replace(/\D/g,'')})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" />
                      </div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">First Name *</label><input type="text" required value={facultyForm.firstName} onChange={e => setFacultyForm({...facultyForm, firstName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Middle Name</label><input type="text" value={facultyForm.middleName} onChange={e => setFacultyForm({...facultyForm, middleName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Last Name *</label><input type="text" required value={facultyForm.lastName} onChange={e => setFacultyForm({...facultyForm, lastName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      2. Employment Details <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 bg-white">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Start School Year *</label>
                      <select value={facultyForm.startSchoolYear} onChange={e => setFacultyForm({...facultyForm, startSchoolYear: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-red-900">
                        <option value="" disabled>Select School Year</option>
                        {schoolYearOptions.map((sy) => (<option key={sy} value={sy}>{sy}</option>))}
                      </select>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      3. Account & Contact <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label><input type="email" required value={facultyForm.email} onChange={e => setFacultyForm({...facultyForm, email: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Contact Number *</label><input type="text" required value={facultyForm.contactNumber} onChange={e => setFacultyForm({...facultyForm, contactNumber: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-red-900" /></div>
                    </div>
                  </details>
                </fieldset></form>
              )}
            </div>

            {/* 3. FIXED FOOTER (Keeps buttons pinned to the bottom) */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              {userType === "learner" ? (
                <button type="submit" disabled={saving} form="learner-form" className="bg-green-700 text-white font-bold py-2.5 px-6 rounded shadow-sm hover:bg-green-800 transition">
                  {saving ? 'Creating…' : 'Create Learner & Generate Credentials'}
                </button>
              ) : (
                <button type="submit" disabled={saving} form="faculty-form" className="bg-[#3e0f0f] text-white font-bold py-2.5 px-6 rounded shadow-sm hover:bg-red-900 transition">
                  {saving ? 'Creating…' : 'Create Faculty & Generate Credentials'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
      {/* EDIT USER MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white shrink-0 z-10 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-800">Edit {userType === 'learner' ? 'Learner' : 'Faculty'}</h2>
              <button onClick={closeModals} className="text-gray-500 hover:text-gray-800 font-bold text-2xl">&times;</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
               {userType === "learner" && (
                <form id="edit-learner-form" onSubmit={handleUpdate} className="space-y-4">
                  <fieldset disabled={saving} className="contents">
                  <details className="group border border-gray-300 rounded shadow-sm" open>
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      1. Basic Identification <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">LRN (12 Digits)</label><input type="text" maxLength={12} value={learnerForm.lrn} onChange={e => setLearnerForm({...learnerForm, lrn: e.target.value.replace(/\D/g,'')})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Birthdate</label><input type="date" value={learnerForm.birthdate} onChange={e => setLearnerForm({...learnerForm, birthdate: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                        <select value={learnerForm.gender} onChange={e => setLearnerForm({...learnerForm, gender: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-blue-600">
                          <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option>
                        </select>
                      </div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">First Name</label><input type="text" value={learnerForm.firstName} onChange={e => setLearnerForm({...learnerForm, firstName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Middle Name</label><input type="text" value={learnerForm.middleName} onChange={e => setLearnerForm({...learnerForm, middleName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label><input type="text" value={learnerForm.lastName} onChange={e => setLearnerForm({...learnerForm, lastName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div className="md:col-span-3"><label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label><input type="email" value={learnerForm.email} onChange={e => setLearnerForm({...learnerForm, email: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      2. Enrollment & School Year <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">School Year</label>
                        <select value={learnerForm.schoolYear} onChange={e => setLearnerForm({...learnerForm, schoolYear: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-blue-600">
                          <option value="" disabled>Select School Year</option>
                          {schoolYearOptions.map((sy) => (<option key={sy} value={sy}>{sy}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Grade Level</label>
                        <select value={learnerForm.gradeLevel} onChange={e => setLearnerForm({...learnerForm, gradeLevel: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-blue-600">
                          <option value="7">Grade 7</option><option value="8">Grade 8</option><option value="9">Grade 9</option><option value="10">Grade 10</option>
                        </select>
                      </div>
                      <div className="flex items-center mt-6">
                        <label className="flex items-center space-x-2 cursor-pointer font-bold text-sm text-gray-800">
                          <input type="checkbox" checked={learnerForm.isStarEligible} onChange={e => setLearnerForm({...learnerForm, isStarEligible: e.target.checked})} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                          <span>⭐ Star/Honors Eligible</span>
                        </label>
                      </div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      3. Demographics <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Mother Tongue</label><input type="text" value={learnerForm.motherTongue} onChange={e => setLearnerForm({...learnerForm, motherTongue: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">IP (Ethnic Group)</label><input type="text" value={learnerForm.ip} onChange={e => setLearnerForm({...learnerForm, ip: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Religion</label><input type="text" value={learnerForm.religion} onChange={e => setLearnerForm({...learnerForm, religion: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      4. Address <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">House # / Street / Purok</label><input type="text" value={learnerForm.houseStreet} onChange={e => setLearnerForm({...learnerForm, houseStreet: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Barangay</label><input type="text" value={learnerForm.barangay} onChange={e => setLearnerForm({...learnerForm, barangay: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Municipality / City</label><input type="text" value={learnerForm.city} onChange={e => setLearnerForm({...learnerForm, city: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Province</label><input type="text" value={learnerForm.province} onChange={e => setLearnerForm({...learnerForm, province: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      5. Parents <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 bg-white space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-bold text-blue-800 mb-1">Father's First Name</label><input type="text" value={learnerForm.fatherFirst} onChange={e => setLearnerForm({...learnerForm, fatherFirst: e.target.value})} className="w-full border p-2 rounded bg-blue-50 focus:outline-none focus:border-blue-600" /></div>
                        <div><label className="block text-xs font-bold text-blue-800 mb-1">Father's Middle Name</label><input type="text" value={learnerForm.fatherMiddle} onChange={e => setLearnerForm({...learnerForm, fatherMiddle: e.target.value})} className="w-full border p-2 rounded bg-blue-50 focus:outline-none focus:border-blue-600" /></div>
                        <div><label className="block text-xs font-bold text-blue-800 mb-1">Father's Last Name</label><input type="text" value={learnerForm.fatherLast} onChange={e => setLearnerForm({...learnerForm, fatherLast: e.target.value})} className="w-full border p-2 rounded bg-blue-50 focus:outline-none focus:border-blue-600" /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-bold text-pink-800 mb-1">Mother's First Name</label><input type="text" value={learnerForm.motherFirst} onChange={e => setLearnerForm({...learnerForm, motherFirst: e.target.value})} className="w-full border p-2 rounded bg-pink-50 focus:outline-none focus:border-blue-600" /></div>
                        <div><label className="block text-xs font-bold text-pink-800 mb-1">Mother's Maiden Middle</label><input type="text" value={learnerForm.motherMiddle} onChange={e => setLearnerForm({...learnerForm, motherMiddle: e.target.value})} className="w-full border p-2 rounded bg-pink-50 focus:outline-none focus:border-blue-600" /></div>
                        <div><label className="block text-xs font-bold text-pink-800 mb-1">Mother's Maiden Last</label><input type="text" value={learnerForm.motherLast} onChange={e => setLearnerForm({...learnerForm, motherLast: e.target.value})} className="w-full border p-2 rounded bg-pink-50 focus:outline-none focus:border-blue-600" /></div>
                      </div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      6. Guardian & Contact <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Guardian Name</label><input type="text" value={learnerForm.guardianName} onChange={e => setLearnerForm({...learnerForm, guardianName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Relationship</label><input type="text" value={learnerForm.guardianRelation} onChange={e => setLearnerForm({...learnerForm, guardianRelation: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Contact Number</label><input type="text" value={learnerForm.contactNumber} onChange={e => setLearnerForm({...learnerForm, contactNumber: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                    </div>
                  </details>
                </fieldset></form>
              )}

              {/* UPGRADED FACULTY FORM */}
              {userType === "faculty" && (
                <form id="edit-faculty-form" onSubmit={handleUpdate} className="space-y-4">
                  <fieldset disabled={saving} className="contents">
                  <details className="group border border-gray-300 rounded shadow-sm" open>
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      1. Basic Information <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Employee No. (Max 7 Digits)</label>
                        <input type="text" maxLength={7} value={facultyForm.employeeNo} onChange={e => setFacultyForm({...facultyForm, employeeNo: e.target.value.replace(/\D/g,'')})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" />
                      </div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">First Name</label><input type="text" value={facultyForm.firstName} onChange={e => setFacultyForm({...facultyForm, firstName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Middle Name</label><input type="text" value={facultyForm.middleName} onChange={e => setFacultyForm({...facultyForm, middleName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label><input type="text" value={facultyForm.lastName} onChange={e => setFacultyForm({...facultyForm, lastName: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      2. Employment Details <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 bg-white">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Start School Year</label>
                      <select value={facultyForm.startSchoolYear} onChange={e => setFacultyForm({...facultyForm, startSchoolYear: e.target.value})} className="w-full border p-2 rounded bg-white focus:outline-none focus:border-blue-600">
                        <option value="" disabled>Select School Year</option>
                        {schoolYearOptions.map((sy) => (<option key={sy} value={sy}>{sy}</option>))}
                      </select>
                    </div>
                  </details>

                  <details className="group border border-gray-300 rounded shadow-sm">
                    <summary className="bg-gray-100 px-4 py-3 font-bold text-gray-800 cursor-pointer flex justify-between">
                      3. Account & Contact <span className="text-gray-500">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label><input type="email" value={facultyForm.email} onChange={e => setFacultyForm({...facultyForm, email: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1">Contact Number</label><input type="text" value={facultyForm.contactNumber} onChange={e => setFacultyForm({...facultyForm, contactNumber: e.target.value})} className="w-full border p-2 rounded focus:outline-none focus:border-blue-600" /></div>
                    </div>
                  </details>
                </fieldset></form>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button type="submit" disabled={saving} form={userType === "learner" ? "edit-learner-form" : "edit-faculty-form"} className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded shadow-sm hover:bg-blue-700 transition">
                {saving ? 'Saving?' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
