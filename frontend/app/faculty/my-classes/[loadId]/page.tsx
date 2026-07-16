"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Student {
  enrollment_id: number;
  lrn: string;
  first_name: string;
  last_name: string;
  initial_grade: string | null;
  transmuted_grade: string | null;
}

interface GradeItem {
  id: number;
  component: string;
  item_name: string;
  max_score: string;
}

interface ItemScore {
  enrollment_id: number;
  grade_item_id: number;
  score: number;
}

// Utility: Convert Initial Grade to Transmuted Grade (Frontend Real-time)
function getTransmutedGrade(initial: number) {
  if (initial >= 99.50) return 100;
  if (initial >= 98.32) return 99;
  if (initial >= 97.14) return 98;
  if (initial >= 95.96) return 97;
  if (initial >= 94.78) return 96;
  if (initial >= 93.60) return 95;
  if (initial >= 92.42) return 94;
  if (initial >= 91.24) return 93;
  if (initial >= 90.06) return 92;
  if (initial >= 88.88) return 91;
  if (initial >= 87.70) return 90;
  if (initial >= 86.52) return 89;
  if (initial >= 85.34) return 88;
  if (initial >= 84.16) return 87;
  if (initial >= 82.98) return 86;
  if (initial >= 81.80) return 85;
  if (initial >= 80.62) return 84;
  if (initial >= 79.44) return 83;
  if (initial >= 78.26) return 82;
  if (initial >= 77.08) return 81;
  if (initial >= 75.90) return 80;
  if (initial >= 74.72) return 79;
  if (initial >= 73.54) return 78;
  if (initial >= 72.36) return 77;
  if (initial >= 71.18) return 76;
  if (initial >= 70.00) return 75;
  if (initial >= 65.34) return 74;
  if (initial >= 60.67) return 73;
  if (initial >= 56.01) return 72;
  if (initial >= 51.34) return 71;
  if (initial >= 46.67) return 70;
  if (initial >= 42.01) return 69;
  if (initial >= 37.34) return 68;
  if (initial >= 32.68) return 67;
  if (initial >= 28.01) return 66;
  if (initial >= 23.35) return 65;
  if (initial >= 18.68) return 64;
  if (initial >= 14.01) return 63;
  if (initial >= 9.35) return 62;
  if (initial >= 4.68) return 61;
  return 60; 
}

export default function Gradebook() {
  const params = useParams();
  const router = useRouter();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  
  // Real-time State: Mapping Enrollment ID -> Grade Item ID -> Score String
  const [localScores, setLocalScores] = useState<Record<number, Record<number, string>>>({});
  
  const [trimester, setTrimester] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dynamic Subject Weights
  const [wwWeight, setWwWeight] = useState(0);
  const [ptWeight, setPtWeight] = useState(0);
  const [exWeight, setExWeight] = useState(0);

  useEffect(() => {
    const fetchGradebookData = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      try {
        const studentRes = await fetch(`http://localhost:5000/api/faculty/gradebook/${params.loadId}?trimester=${trimester}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const studentData = await studentRes.json();
        
        const itemsRes = await fetch(`http://localhost:5000/api/faculty/grade-items/${params.loadId}?trimester=${trimester}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const itemsData = await itemsRes.json();

        if (studentRes.ok && itemsRes.ok) {
          setStudents(studentData.students);
          setGradeItems(itemsData.items);
            // Set the dynamic weights!
          if (studentData.weights) {
             setWwWeight(studentData.weights.ww);
             setPtWeight(studentData.weights.pt);
             setExWeight(studentData.weights.ex);
          }
          // Build initial local state for interactive inputs
          const initialLocal: Record<number, Record<number, string>> = {};
          studentData.students.forEach((s: Student) => {
             initialLocal[s.enrollment_id] = {};
          });
          if (studentData.itemScores) {
              studentData.itemScores.forEach((s: ItemScore) => {
                  if (!initialLocal[s.enrollment_id]) initialLocal[s.enrollment_id] = {};
                  initialLocal[s.enrollment_id][s.grade_item_id] = s.score.toString();
              });
          }
          setLocalScores(initialLocal);

        } else {
          setError(studentData.error || itemsData.error || "Failed to load gradebook.");
        }
      } catch (err) {
        setError("Server connection error.");
      } finally {
        setLoading(false);
      }
    };
    fetchGradebookData();
  }, [params.loadId, trimester]);

  // Interactive Input Handler
  const handleScoreChange = (enrollmentId: number, itemId: number, value: string) => {
    setLocalScores(prev => ({
      ...prev,
      [enrollmentId]: {
        ...(prev[enrollmentId] || {}),
        [itemId]: value
      }
    }));
  };

  const handleSave = async () => {
    const scoresToSave: { enrollment_id: number; grade_item_id: number; score: number }[] = [];
    
    // Convert React State into the array format for the backend
    Object.entries(localScores).forEach(([enrollmentId, items]) => {
        Object.entries(items).forEach(([itemId, scoreVal]) => {
            if (scoreVal !== "") {
                scoresToSave.push({
                    enrollment_id: parseInt(enrollmentId),
                    grade_item_id: parseInt(itemId),
                    score: parseFloat(scoreVal)
                });
            }
        });
    });
  
    if (scoresToSave.length === 0) {
      alert("No scores to save. Please enter some grades first.");
      return;
    }
  
    try {
      const payload = {
        loadId: params.loadId,
        trimester: trimester,
        scores: scoresToSave 
      };
  
      const res = await fetch("http://localhost:5000/api/faculty/save-grades", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload),
      });
  
      if (res.ok) {
        alert("Grades successfully saved to database!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save grades.");
      }
    } catch (error) {
      alert("Server error while saving grades.");
    }
  };

  const wwItems = gradeItems.filter(item => item.component === 'WW');
  const ptItems = gradeItems.filter(item => item.component === 'PT');
  const exItems = gradeItems.filter(item => item.component === 'EX');

  // Math Helper: Calculate Component Total, PS, and WS
  const getComponentStats = (enrollmentId: number, items: GradeItem[], weight: number) => {
      let totalScore = 0;
      let maxTotal = 0;
      
      items.forEach(item => {
          maxTotal += parseFloat(item.max_score || "0");
          const val = localScores[enrollmentId]?.[item.id];
          if (val && !isNaN(parseFloat(val))) {
              totalScore += parseFloat(val);
          }
      });

      const ps = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;
      const ws = maxTotal > 0 ? ps * (Number(weight) / 100) : 0;

      return { total: totalScore, maxTotal, ps, ws };
  };

  // Math Helper: Max Scores for Header
  const getComponentMaxStats = (items: GradeItem[], weight: number) => {
      const maxTotal = items.reduce((acc, item) => acc + parseFloat(item.max_score || "0"), 0);
      return { total: maxTotal, ps: maxTotal > 0 ? 100 : 0, ws: maxTotal > 0 ? Number(weight) : 0 };
  };
  
  const wwMax = getComponentMaxStats(wwItems, wwWeight);
  const ptMax = getComponentMaxStats(ptItems, ptWeight);
  const exMax = getComponentMaxStats(exItems, exWeight);

  return (
    <div className="p-8">
      <div className="max-w-[1400px] mx-auto">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            Encode Grades 
          </h1>
          <div className="flex gap-4">
            <Link 
              href={`/faculty/manage-items/${params.loadId}`} 
              className="bg-green-700 text-white px-4 py-2 rounded shadow hover:bg-green-800 flex items-center gap-2 font-semibold text-sm transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              Manage Grade Items
            </Link>
            <Link 
              href="/faculty/my-classes" 
              className="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 font-semibold text-sm transition"
            >
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="bg-gray-100 border border-gray-300 p-4 rounded-lg mb-6 text-sm text-gray-700 shadow-sm">
          <p className="font-bold mb-1">Legend:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Manage Grade Items — add/edit/delete WW, PT, EX items.</li>
            <li>Scores instantly auto-calc PS (Percentage Score) & WS (Weighted Score) as you type.</li>
            <li>WW/PT/EX weights: {wwWeight}% / {ptWeight}% / {exWeight}%</li>
          </ul>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map((tri) => (
            <button
              key={tri}
              onClick={() => setTrimester(tri)}
              className={`px-6 py-2 border rounded font-bold shadow-sm transition-colors text-sm ${
                trimester === tri 
                  ? "bg-[#5D1919] text-white border-[#5D1919]" 
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {tri === 1 ? "1st" : tri === 2 ? "2nd" : "3rd"} Trimester
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded shadow-sm text-red-700 font-semibold">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden overflow-x-auto">
          {loading ? (
             <p className="p-6 text-gray-500 italic text-center">Loading interactive gradebook...</p>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-[#5D1919] text-white text-[11px] text-center font-bold tracking-wider uppercase">
                  <th className="p-3 border-r border-[#4A1414] w-10">#</th>
                  <th className="p-3 border-r border-[#4A1414] text-left min-w-[220px]">Learner's Name</th>
                  <th className="p-2 border-r border-[#4A1414]" colSpan={wwItems.length + 3}>Written Works ({wwWeight}%)</th>
                  <th className="p-2 border-r border-[#4A1414]" colSpan={ptItems.length + 3}>Performance Tasks ({ptWeight}%)</th>
                  <th className="p-2 border-r border-[#4A1414]" colSpan={exItems.length + 3}>Exams ({exWeight}%)</th>
                  <th className="p-2 border-r border-[#4A1414] w-20 leading-tight bg-[#4A1414]">INITIAL<br/>GRADE</th>
                  <th className="p-2 w-20 leading-tight bg-[#4A1414]">TRIMESTER<br/>GRADE</th>
                </tr>
                <tr className="bg-[#4A1414] text-white text-[11px] text-center font-bold uppercase">
                  <th className="border-r border-[#380F0F]"></th>
                  <th className="border-r border-[#380F0F]"></th>
                  
                  {wwItems.map(item => <th key={item.id} className="p-2 border-r border-[#380F0F] min-w-[60px]">{item.item_name}</th>)}
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px]">Total</th>
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px]">PS</th>
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px] bg-[#380F0F]">WS</th>

                  {ptItems.map(item => <th key={item.id} className="p-2 border-r border-[#380F0F] min-w-[60px]">{item.item_name}</th>)}
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px]">Total</th>
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px]">PS</th>
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px] bg-[#380F0F]">WS</th>

                  {exItems.map(item => <th key={item.id} className="p-2 border-r border-[#380F0F] min-w-[60px]">{item.item_name}</th>)}
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px]">Total</th>
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px]">PS</th>
                  <th className="p-2 border-r border-[#380F0F] min-w-[60px] bg-[#380F0F]">WS</th>

                  <th className="border-r border-[#380F0F]"></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {/* Dynamic Highest Possible Score Row */}
                <tr className="bg-gray-100 font-bold text-center text-xs border-b border-gray-300 text-gray-800">
                  <td className="p-2 border-r border-gray-300"></td>
                  <td className="p-2 border-r border-gray-300 text-left uppercase">Highest Possible Score</td>
                  
                  {wwItems.map(item => <td key={item.id} className="p-2 border-r border-gray-300">{item.max_score}</td>)}
                  <td className="p-2 border-r border-gray-300 text-gray-600">{wwMax.total || 0}</td>
                  <td className="p-2 border-r border-gray-300 text-gray-600">{wwMax.ps.toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 text-gray-600">{wwMax.ws.toFixed(2)}</td>

                  {ptItems.map(item => <td key={item.id} className="p-2 border-r border-gray-300">{item.max_score}</td>)}
                  <td className="p-2 border-r border-gray-300 text-gray-600">{ptMax.total || 0}</td>
                  <td className="p-2 border-r border-gray-300 text-gray-600">{ptMax.ps.toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 text-gray-600">{ptMax.ws.toFixed(2)}</td>

                  {exItems.map(item => <td key={item.id} className="p-2 border-r border-gray-300">{item.max_score}</td>)}
                  <td className="p-2 border-r border-gray-300 text-gray-600">{exMax.total || 0}</td>
                  <td className="p-2 border-r border-gray-300 text-gray-600">{exMax.ps.toFixed(2)}</td>
                  <td className="p-2 border-r border-gray-300 text-gray-600">{exMax.ws.toFixed(2)}</td>

                  <td className="border-r border-gray-300"></td>
                  <td></td>
                </tr>

                {/* Interactive Student Rows */}
                {students.map((student, index) => {
                  const wwStats = getComponentStats(student.enrollment_id, wwItems, wwWeight);
                  const ptStats = getComponentStats(student.enrollment_id, ptItems, ptWeight);
                  const exStats = getComponentStats(student.enrollment_id, exItems, exWeight);
                  
                  // Live Math for Initial and Transmuted
                  const liveInitial = wwStats.ws + ptStats.ws + exStats.ws;
                  const liveTransmuted = liveInitial > 0 ? getTransmutedGrade(liveInitial) : null;

                  return (
                  <tr key={student.enrollment_id} className="border-b border-gray-200 hover:bg-gray-50 text-center text-[13px]">
                    <td className="p-2 border-r border-gray-200 text-gray-500">{index + 1}</td>
                    <td className="p-2 font-medium text-gray-800 border-r border-gray-200 text-left">
                      {student.last_name}, {student.first_name}
                    </td>
                    
                    {/* WW Interactive Inputs */}
                    {wwItems.map(item => (
                       <td key={item.id} className="p-1 border-r border-gray-200">
                            <input 
                              type="number" 
                              value={localScores[student.enrollment_id]?.[item.id] || ""}
                              onChange={(e) => handleScoreChange(student.enrollment_id, item.id, e.target.value)}
                              className="w-full text-center border border-gray-300 rounded p-1 focus:outline-none focus:border-blue-500 text-gray-800" 
                            />
                       </td>
                    ))}
                    <td className="p-2 border-r border-gray-200 font-semibold text-gray-700 bg-gray-50">{wwStats.total || 0}</td>
                    <td className="p-2 border-r border-gray-200 text-gray-600 bg-gray-50">{wwStats.ps.toFixed(2)}</td>
                    <td className="p-2 border-r border-gray-200 text-gray-600 bg-gray-50 font-semibold">{wwStats.ws.toFixed(2)}</td>

                    {/* PT Interactive Inputs */}
                    {ptItems.map(item => (
                       <td key={item.id} className="p-1 border-r border-gray-200">
                         <input 
                           type="number" 
                           value={localScores[student.enrollment_id]?.[item.id] || ""}
                           onChange={(e) => handleScoreChange(student.enrollment_id, item.id, e.target.value)}
                           className="w-full text-center border border-gray-300 rounded p-1 focus:outline-none focus:border-blue-500 text-gray-800" 
                         />
                       </td>
                    ))}
                    <td className="p-2 border-r border-gray-200 font-semibold text-gray-700 bg-gray-50">{ptStats.total || 0}</td>
                    <td className="p-2 border-r border-gray-200 text-gray-600 bg-gray-50">{ptStats.ps.toFixed(2)}</td>
                    <td className="p-2 border-r border-gray-200 text-gray-600 bg-gray-50 font-semibold">{ptStats.ws.toFixed(2)}</td>

                    {/* EX Interactive Inputs */}
                    {exItems.map(item => (
                       <td key={item.id} className="p-1 border-r border-gray-200">
                         <input 
                           type="number" 
                           value={localScores[student.enrollment_id]?.[item.id] || ""}
                           onChange={(e) => handleScoreChange(student.enrollment_id, item.id, e.target.value)}
                           className="w-full text-center border border-gray-300 rounded p-1 focus:outline-none focus:border-blue-500 text-gray-800" 
                         />
                       </td>
                    ))}
                    <td className="p-2 border-r border-gray-200 font-semibold text-gray-700 bg-gray-50">{exStats.total || 0}</td>
                    <td className="p-2 border-r border-gray-200 text-gray-600 bg-gray-50">{exStats.ps.toFixed(2)}</td>
                    <td className="p-2 border-r border-gray-200 text-gray-600 bg-gray-50 font-semibold">{exStats.ws.toFixed(2)}</td>

                    {/* Live Output */}
                    <td className="p-2 text-center bg-gray-50 border-r border-gray-200 font-bold text-gray-700">
                      {liveInitial > 0 ? liveInitial.toFixed(2) : "-"}
                    </td>
                    <td className="p-2 text-center bg-gray-50 font-bold text-[#147a3e] text-base">
                      {liveTransmuted || "-"}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
          
          {students.length > 0 && (
            <div className="p-4 bg-white border-t border-gray-200 flex justify-center">
              <button 
                  onClick={handleSave}
                  className="bg-green-700 text-white font-bold py-2 px-8 rounded shadow hover:bg-green-800 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                  Save Scores
                </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}