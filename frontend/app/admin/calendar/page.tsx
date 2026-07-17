"use client";

import { useEffect, useState } from "react";

// --- INTERFACES ---
interface SchoolEvent {
  id: number;
  title: string;
  event_date: string;
  description: string;
}

interface MonthlySummary {
  month_name: string;
  total_days: number;
}

export default function ManageCalendar() {
  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState<"events" | "schooldays">("events");

  // ==========================================
  //         STATE: SCHOOL EVENTS
  // ==========================================
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ==========================================
  //         STATE: SCHOOL DAYS (SF2)
  // ==========================================
  const [daysForm, setDaysForm] = useState<{schoolYear: string, monthName: string, totalDays: number | string}>({
    schoolYear: '2026-2027',
    monthName: 'August',
    totalDays: '' 
  });
  const [daysMessage, setDaysMessage] = useState('');
  const [daysSubmitting, setDaysSubmitting] = useState(false);
  
  // NEW: State to hold the 12-month summary
  const [yearlySummary, setYearlySummary] = useState<MonthlySummary[]>([]);

  const months = [
    "August", "September", "October", "November", "December", 
    "January", "February", "March", "April", "May", "June", "July"
  ];

  // ==========================================
  //         LOGIC: SCHOOL EVENTS
  // ==========================================
  const fetchEvents = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/admin/calendar");
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to fetch calendar events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/calendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title, event_date: eventDate, description }),
      });

      const data = await res.json();
      
      if (res.ok) {
        const updatedList = [...events, data.event].sort((a, b) => 
            new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        );
        setEvents(updatedList);
        setTitle("");
        setEventDate("");
        setDescription("");
      } else {
        setError(data.error || "Failed to add event.");
      }
    } catch (err) {
      setError("Server error while adding event.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/admin/calendar/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setEvents(events.filter((ev) => ev.id !== id));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete.");
      }
    } catch (err) {
      setError("Server error during deletion.");
    }
  };

  // ==========================================
  //         LOGIC: SCHOOL DAYS (SF2)
  // ==========================================

  // NEW: Helper function to fetch the full 12 months at once
  const fetchYearlySummary = async (year: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/admin/school-days?schoolYear=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setYearlySummary(data.calendar || []);
    } catch (err) {
      console.error("Failed to fetch summary", err);
    }
  };

  useEffect(() => {
    if (activeTab === "schooldays") {
      // 1. Fetch the data for the specific input box
      const fetchMonthDays = async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`http://localhost:5000/api/admin/school-days?schoolYear=${daysForm.schoolYear}&monthName=${daysForm.monthName}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          
          if (res.ok && data.totalDays !== "") {
            setDaysForm(prev => ({ ...prev, totalDays: data.totalDays }));
          } else {
            setDaysForm(prev => ({ ...prev, totalDays: '' }));
          }
        } catch (err) {
          console.error("Failed to fetch days for this month", err);
        }
      };
      
      fetchMonthDays();
    }
  }, [daysForm.schoolYear, daysForm.monthName, activeTab]);

  // Fetch the 12-month summary whenever the school year changes or tab opens
  useEffect(() => {
    if (activeTab === "schooldays" && daysForm.schoolYear) {
      fetchYearlySummary(daysForm.schoolYear);
    }
  }, [daysForm.schoolYear, activeTab]);

  const handleSaveDays = async (e: React.FormEvent) => {
    e.preventDefault();
    setDaysSubmitting(true);
    setDaysMessage('');

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/admin/school-days", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(daysForm)
      });
      
      const data = await res.json();
      if (res.ok) {
        setDaysMessage('School days successfully updated!');
        // Instantly refresh the summary table to show the newly saved value
        fetchYearlySummary(daysForm.schoolYear);
      } else {
        setDaysMessage(data.error || 'Failed to update calendar.');
      }
    } catch (error) {
      setDaysMessage('Server error occurred.');
    } finally {
      setDaysSubmitting(false);
    }
  };
  
  // Calculate total days for the entire year
  const totalYearlyDays = yearlySummary.reduce((sum, item) => sum + Number(item.total_days), 0);

  // ==========================================
  //                 RENDER
  // ==========================================
  return (
    <div className="p-8 max-w-6xl mx-auto">
      
      {/* Tabs Navigation */}
      <div className="flex space-x-4 mb-8 border-b">
        <button 
          onClick={() => setActiveTab("events")}
          className={`pb-2 px-4 font-bold transition-colors ${activeTab === "events" ? "border-b-4 border-[#5D1919] text-[#5D1919]" : "text-gray-500 hover:text-gray-700"}`}
        >
          School Events
        </button>
        <button 
          onClick={() => setActiveTab("schooldays")}
          className={`pb-2 px-4 font-bold transition-colors ${activeTab === "schooldays" ? "border-b-4 border-[#5D1919] text-[#5D1919]" : "text-gray-500 hover:text-gray-700"}`}
        >
          Monthly School Days (SF2)
        </button>
      </div>

      {/* ------------------------------------------------ */}
      {/* TAB 1: SCHOOL EVENTS                               */}
      {/* ------------------------------------------------ */}
      {activeTab === "events" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Add New Event</h2>
              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Event Title</label>
                  <input 
                    type="text" required value={title} onChange={(e) => setTitle(e.target.value)} 
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#5D1919]"
                    placeholder="e.g. 1st Quarter Examinations"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                  <input 
                    type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} 
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#5D1919]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description (Optional)</label>
                  <textarea 
                    rows={3} value={description} onChange={(e) => setDescription(e.target.value)} 
                    className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[#5D1919]"
                    placeholder="Brief details about the event..."
                  />
                </div>
                <button type="submit" disabled={submitting} className="w-full bg-[#5D1919] hover:bg-[#3e0f0f] text-white font-bold py-2 px-4 rounded transition disabled:opacity-70">
                  {submitting ? "Saving..." : "Save Event"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="mb-6 border-b pb-4">
              <h1 className="text-3xl font-bold text-gray-800">Calendar of Activities</h1>
              <p className="text-gray-600 mt-1">Manage important dates, holidays, and school activities.</p>
            </div>
            {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 font-semibold mb-6">{error}</div>}
            
            {loading ? (
              <p className="text-center text-gray-500 italic py-8">Loading calendar...</p>
            ) : events.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-sm border text-center text-gray-500">
                No upcoming events found. Add your first event using the form.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((ev) => {
                  const dateObj = new Date(ev.event_date);
                  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  const isPast = dateObj < new Date(new Date().setHours(0,0,0,0));

                  return (
                    <div key={ev.id} className={`bg-white border rounded-lg shadow-sm flex items-center overflow-hidden transition-opacity ${isPast ? 'opacity-60 border-gray-200' : 'border-[#5D1919]/20'}`}>
                      <div className={`p-6 flex flex-col justify-center items-center text-white min-w-[100px] ${isPast ? 'bg-gray-400' : 'bg-[#5D1919]'}`}>
                        <span className="text-sm font-semibold uppercase">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-3xl font-black">{dateObj.getDate()}</span>
                      </div>
                      <div className="p-4 flex-1">
                        <h3 className={`font-bold text-lg ${isPast ? 'text-gray-600' : 'text-gray-900'}`}>{ev.title}</h3>
                        {ev.description && <p className="text-gray-600 text-sm mt-1">{ev.description}</p>}
                        <p className="text-xs font-semibold text-gray-400 mt-2">{formattedDate}</p>
                      </div>
                      <div className="p-4">
                        <button onClick={() => handleDelete(ev.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition" title="Delete Event">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ */}
      {/* TAB 2: MONTHLY SCHOOL DAYS (For SF2)             */}
      {/* ------------------------------------------------ */}
      {activeTab === "schooldays" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* LEFT SIDE: Data Entry Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-800">Set Monthly School Days</h2>
              <p className="text-gray-600 mt-1 text-sm">Configure the total number of valid school days per month. This data is required for generating the School Form 2 (SF2).</p>
            </div>
            
            {daysMessage && (
              <div className={`mb-4 p-3 rounded font-semibold ${daysMessage.includes('error') || daysMessage.includes('Failed') ? 'bg-red-50 text-red-700 border-l-4 border-red-500' : 'bg-green-50 text-green-700 border-l-4 border-green-500'}`}>
                {daysMessage}
              </div>
            )}
            
            <form onSubmit={handleSaveDays} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">School Year</label>
                <input 
                  type="text" 
                  value={daysForm.schoolYear}
                  onChange={(e) => setDaysForm({...daysForm, schoolYear: e.target.value})}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-[#5D1919]" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Month</label>
                <select 
                  value={daysForm.monthName}
                  onChange={(e) => setDaysForm({...daysForm, monthName: e.target.value})}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-[#5D1919] bg-white"
                >
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Total School Days</label>
                <input 
                  type="number" 
                  min="1" max="31"
                  value={daysForm.totalDays}
                  onChange={(e) => setDaysForm({...daysForm, totalDays: e.target.value === '' ? '' : parseInt(e.target.value)})}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-[#5D1919]" 
                />
              </div>

              <button 
                type="submit" 
                disabled={daysSubmitting}
                className="w-full bg-[#5D1919] text-white font-bold py-2 rounded hover:bg-[#3e0f0f] transition disabled:opacity-70 mt-4"
              >
                {daysSubmitting ? "Saving..." : "Save Calendar Setup"}
              </button>
            </form>
          </div>

          {/* RIGHT SIDE: 12-Month Summary Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
             <div className="mb-4 border-b pb-4 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-gray-800">12-Month Summary</h2>
                <p className="text-gray-500 text-sm mt-1">For S.Y. {daysForm.schoolYear}</p>
              </div>
              <div className="text-right">
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Total Year</span>
                <span className="text-2xl font-black text-[#5D1919]">{totalYearlyDays || "-"}</span>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-700">
                  <th className="py-2 px-4 border-b font-bold">Month</th>
                  <th className="py-2 px-4 border-b font-bold text-right">Total Days</th>
                </tr>
              </thead>
              <tbody>
                {months.map(m => {
                  const monthData = yearlySummary.find(y => y.month_name === m);
                  const isCurrentSelection = daysForm.monthName === m;
                  
                  return (
                    <tr key={m} className={`border-b last:border-0 ${isCurrentSelection ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                      <td className={`py-2 px-4 ${isCurrentSelection ? 'font-bold text-[#5D1919]' : 'text-gray-700'}`}>
                        {m}
                      </td>
                      <td className={`py-2 px-4 text-right ${isCurrentSelection ? 'font-bold text-[#5D1919]' : 'text-gray-900'}`}>
                        {monthData ? (
                           <span className="bg-green-100 text-green-800 py-1 px-2 rounded-full text-xs font-bold">
                             {monthData.total_days}
                           </span>
                        ) : (
                          <span className="text-gray-300 italic">Not set</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}