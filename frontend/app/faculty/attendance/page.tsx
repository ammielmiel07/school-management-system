"use client";

import { useEffect, useState } from "react";

// --- INTERFACES ---
interface Student {
  id: number;
  lrn: string;
  name: string;
  gender: "Male" | "Female";
}

interface AttendanceRecord {
  student_id: number;
  absent: number;
  tardy: number;
}

export default function FacultyAttendance() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // --- STATE ---
  const [schoolYear, setSchoolYear] = useState<string>(""); 
  const [selectedMonth, setSelectedMonth] = useState("August");
  const [totalSchoolDays, setTotalSchoolDays] = useState<number | null>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceRecord>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const months = [
    "August", "September", "October", "November", "December", 
    "January", "February", "March", "April", "May", "June", "July"
  ];

  // ==========================================
  //         DATA FETCHING
  // ==========================================
  
  // 1. Fetch Class Data (School Year & Students)
  useEffect(() => {
    const fetchClassData = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/faculty/advisory-class`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.isAdviser) {
          setSchoolYear(data.school_year);

          // FIX: Mapped to learner_id instead of enrollment_id to avoid DB Foreign Key errors
          const mappedStudents = (data.students || []).map((s: any) => ({
            id: s.learner_id, 
            lrn: s.lrn,
            name: `${s.last_name}, ${s.first_name}`,
            gender: s.gender
          }));
          setStudents(mappedStudents);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch class data", err);
        setLoading(false);
      }
    };
    
    fetchClassData();
  }, [API_URL]);

  // 2. Fetch School Days & Attendance
  useEffect(() => {
    if (!schoolYear) return; 

    const fetchMonthData = async () => {
      setLoading(true);
      setMessage(null);

      try {
        const token = localStorage.getItem("token");
        
        // --- A. Fetch Total School Days ---
        const daysRes = await fetch(`${API_URL}/api/faculty/school-days?schoolYear=${schoolYear}&monthName=${selectedMonth}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Safety check to prevent JSON crash
        if (!daysRes.ok) throw new Error(`School days fetch failed with status ${daysRes.status}`);
        const daysData = await daysRes.json();
        
        if (daysData.totalDays !== "" && daysData.totalDays !== null) {
          setTotalSchoolDays(Number(daysData.totalDays));
        } else {
          setTotalSchoolDays(null);
        }

        // --- B. Fetch Attendance ONLY if there are students ---
        if (students.length > 0) {
          const attendanceRes = await fetch(`${API_URL}/api/faculty/attendance?schoolYear=${schoolYear}&monthName=${selectedMonth}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // Safety check to prevent JSON crash
          if (!attendanceRes.ok) throw new Error(`Attendance fetch failed with status ${attendanceRes.status}`);
          const attendanceData = await attendanceRes.json();
          
          const attendanceMap: Record<number, AttendanceRecord> = {};
          
          // Pre-fill zeros
          students.forEach(s => {
            attendanceMap[s.id] = { student_id: s.id, absent: 0, tardy: 0 };
          });

          // Override with DB data
          if (attendanceData.attendance) {
            attendanceData.attendance.forEach((record: AttendanceRecord) => {
              attendanceMap[record.student_id] = record;
            });
          }
          
          setAttendance(attendanceMap);
        }

      } catch (err) {
        console.error("Failed to fetch month data:", err);
        setTotalSchoolDays(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthData();
  }, [schoolYear, selectedMonth, API_URL, students]); 

  // ==========================================
  //         HANDLERS
  // ==========================================
  
  const handleInputChange = (studentId: number, field: "absent" | "tardy", value: string) => {
    const numValue = value === "" ? 0 : parseInt(value);
    
    if (numValue < 0) return;
    if (field === "absent" && totalSchoolDays && numValue > totalSchoolDays) return;

    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem("token");
      const attendanceArray = Object.values(attendance);

      const res = await fetch(`${API_URL}/api/faculty/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          schoolYear,
          monthName: selectedMonth,
          records: attendanceArray
        })
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Attendance records saved successfully!" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save attendance." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "A server error occurred." });
    } finally {
      setSaving(false);
    }
  };

  const maleStudents = students.filter(s => s.gender === "Male");
  const femaleStudents = students.filter(s => s.gender === "Female");

  // ==========================================
  //                 RENDER
  // ==========================================
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800">Monthly Attendance</h1>
        <p className="text-gray-600 mt-1">Record student absences and tardiness for School Form 2 (SF2).</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Month</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 p-2 rounded focus:outline-none focus:border-[#5D1919] bg-white font-semibold text-gray-800"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          
          <div className="pl-4 border-l">
            <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total School Days</span>
            {loading && !schoolYear ? (
               <span className="text-sm text-gray-400 italic">Checking...</span>
            ) : totalSchoolDays !== null ? (
               <span className="text-2xl font-black text-[#5D1919]">{totalSchoolDays}</span>
            ) : (
               <span className="text-sm font-semibold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">Not configured by Admin</span>
            )}
          </div>
        </div>

        <button 
            onClick={handleSave}
            disabled={saving || totalSchoolDays === null || students.length === 0}
            className="bg-[#5D1919] text-white font-bold py-2 px-6 rounded hover:bg-[#3e0f0f] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {saving ? "Saving..." : "Save Attendance"}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded font-semibold ${message.type === 'error' ? 'bg-red-50 text-red-700 border-l-4 border-red-500' : 'bg-green-50 text-green-700 border-l-4 border-green-500'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Loading overlay for when swapping months */}
        {loading && students.length > 0 && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
             <span className="text-[#5D1919] font-bold">Loading {selectedMonth}...</span>
          </div>
        )}

        {loading && students.length === 0 ? (
          <p className="text-center text-gray-500 italic py-12">Loading data...</p>
        ) : students.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No advisory students found.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#3e0f0f] text-white uppercase tracking-wider text-xs border-b">
                <th className="py-3 px-6 font-bold w-16">No.</th>
                <th className="py-3 px-6 font-bold">Learner Name</th>
                <th className="py-3 px-6 font-bold w-32 text-center">Absences</th>
                <th className="py-3 px-6 font-bold w-32 text-center">Tardies</th>
              </tr>
            </thead>
            <tbody>
              {/* MALE STUDENTS */}
              {maleStudents.length > 0 && (
                <tr>
                  <td colSpan={4} className="bg-blue-50 py-2 px-6 font-bold text-blue-900 border-b">MALE</td>
                </tr>
              )}
              {maleStudents.map((student, index) => (
                <tr key={student.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-6 text-gray-500">{index + 1}</td>
                  <td className="py-2 px-6 font-semibold text-gray-800">{student.name}</td>
                  <td className="py-2 px-6 text-center">
                    <input 
                        type="number" min="0" max={totalSchoolDays || 31}
                        value={attendance[student.id]?.absent ?? ""}
                        onChange={(e) => handleInputChange(student.id, "absent", e.target.value)}
                        placeholder="0"
                        disabled={totalSchoolDays === null || loading}
                        className="w-16 border border-gray-300 p-1 text-center rounded focus:outline-none focus:border-[#5D1919] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                  <td className="py-2 px-6 text-center">
                    <input 
                        type="number" min="0"
                        value={attendance[student.id]?.tardy ?? ""}
                        onChange={(e) => handleInputChange(student.id, "tardy", e.target.value)}
                        placeholder="0"
                        disabled={totalSchoolDays === null || loading}
                        className="w-16 border border-gray-300 p-1 text-center rounded focus:outline-none focus:border-[#5D1919] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                </tr>
              ))}

              {/* FEMALE STUDENTS */}
              {femaleStudents.length > 0 && (
                <tr>
                  <td colSpan={4} className="bg-pink-50 py-2 px-6 font-bold text-pink-900 border-b">FEMALE</td>
                </tr>
              )}
              {femaleStudents.map((student, index) => (
                <tr key={student.id} className="border-b hover:bg-gray-50 last:border-0">
                  <td className="py-2 px-6 text-gray-500">{index + 1}</td>
                  <td className="py-2 px-6 font-semibold text-gray-800">{student.name}</td>
                  <td className="py-2 px-6 text-center">
                    <input 
                        type="number" min="0" max={totalSchoolDays || 31}
                        value={attendance[student.id]?.absent ?? ""}
                        onChange={(e) => handleInputChange(student.id, "absent", e.target.value)}
                        placeholder="0"
                        disabled={totalSchoolDays === null || loading}
                        className="w-16 border border-gray-300 p-1 text-center rounded focus:outline-none focus:border-[#5D1919] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                  <td className="py-2 px-6 text-center">
                    <input 
                        type="number" min="0"
                        value={attendance[student.id]?.tardy ?? ""}
                        onChange={(e) => handleInputChange(student.id, "tardy", e.target.value)}
                        placeholder="0"
                        disabled={totalSchoolDays === null || loading}
                        className="w-16 border border-gray-300 p-1 text-center rounded focus:outline-none focus:border-[#5D1919] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}