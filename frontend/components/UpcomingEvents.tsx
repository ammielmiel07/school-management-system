"use client";

import { useEffect, useState } from "react";

interface SchoolEvent {
  id: number;
  title: string;
  event_date: string;
  description: string;
}

export default function UpcomingEvents() {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/admin/calendar");
        const data = await res.json();
        if (res.ok && data.events) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const upcoming = data.events
            .filter((ev: SchoolEvent) => new Date(ev.event_date) >= today)
            .slice(0, 4); // Only show the next 4 events
          setEvents(upcoming);
        }
      } catch (err) {
        console.error("Failed to load events.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center text-gray-700 bg-white">
        <h2 className="font-bold flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          Upcoming Events
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-400 italic text-center">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 italic text-center">No upcoming events scheduled.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {events.map((ev) => {
              const dateObj = new Date(ev.event_date);
              return (
                <li key={ev.id} className="p-4 hover:bg-gray-50 flex items-center gap-4 transition">
                  <div className="bg-[#5D1919]/10 text-[#5D1919] rounded px-3 py-2 text-center min-w-[65px]">
                    <span className="block text-xs font-bold uppercase">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="block text-lg font-black leading-none mt-1">{dateObj.getDate()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">{ev.title}</h3>
                    {ev.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{ev.description}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}