"use client";

import { schoolDate } from '@/lib/dates';

import { apiFetch } from '@/lib/api';
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface DashboardStats {
  total_learners: number;
  total_faculty: number;
  enrolled_this_year: number;
  active_sections: number;
}

interface DashboardData {
  active_school_year: string;
  active_trisemester: number;
  stats: DashboardStats;
}

interface CarouselImage {
  id: number;
  image_url: string;
}

interface SchoolEvent {
  id: number;
  title: string;
  event_date: string;
  description: string;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("token");
      
      try {
        // Fetch stats, carousel images, and calendar events simultaneously
        const [dashRes, carouselRes, calendarRes] = await Promise.all([
          apiFetch("/api/admin/dashboard", {
            headers: { Authorization: `Bearer ${token}` }
          }),
          apiFetch("/api/admin/carousel"),
          apiFetch("/api/admin/calendar")
        ]);
        
        const payload = await dashRes.json();
        const carouselPayload = await carouselRes.json();
        const calendarPayload = await calendarRes.json();
        
        if (!dashRes.ok) {
          setError(payload.error || "Failed to load dashboard data.");
          return;
        }

        setData(payload);
        
        if (carouselRes.ok && carouselPayload.images) {
          setCarouselImages(carouselPayload.images);
        }

        if (calendarRes.ok && calendarPayload.events) {
          // Filter to show only upcoming events and limit to the next 4
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const upcoming = calendarPayload.events
            .filter((ev: SchoolEvent) => schoolDate(ev.event_date) >= today)
            .slice(0, 4);
            
          setEvents(upcoming);
        }

      } catch {
        setError("Cannot connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (carouselImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000); 

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6 gap-6">
      
      {/* Top Header Banner */}
      <div className="bg-[#5D1919] text-white rounded-lg p-4 flex flex-col md:flex-row justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-wide">Prudencia D. Fule Memorial National High School</h1>
          <p className="text-sm text-red-200">Online Management System</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <Link href="/admin/carousel" className="border border-white/40 bg-white/10 hover:bg-white/20 transition px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Manage Carousel
          </Link>
          <Link href="/admin/calendar" className="border border-white/40 bg-white/10 hover:bg-white/20 transition px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Calendar of Activities
          </Link>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        
        {/* Left Column: Announcements / Carousel & Upcoming Events */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full">
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center text-gray-700">
              <h2 className="font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
                Announcements
              </h2>
              <span className="text-xs uppercase font-semibold text-gray-400">Carousel</span>
            </div>
            
            {/* Dynamic Carousel Container (Perfect 16:9 Aspect Ratio) */}
            <div className="relative bg-gray-900 w-full aspect-video flex items-center justify-center text-center overflow-hidden group">
              {carouselImages.length > 0 ? (
                <>
                  {carouselImages.map((img, index) => (
                    <div 
                      key={img.id} 
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                    >
                      <Image
                        fill unoptimized sizes="(max-width: 768px) 100vw, 70vw"
                        src={img.image_url}
                        alt={`Announcement ${index + 1}`} 
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ))}
                  
                  {/* Navigation Arrows */}
                  {carouselImages.length > 1 && (
                    <>
                      <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-5xl transition opacity-0 group-hover:opacity-100 drop-shadow-md z-20">&lsaquo;</button>
                      <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-5xl transition opacity-0 group-hover:opacity-100 drop-shadow-md z-20">&rsaquo;</button>
                      
                      {/* Dots Indicator */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                        {carouselImages.map((_, i) => (
                          <button 
                            key={i} 
                            onClick={() => setCurrentSlide(i)}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="relative bg-gradient-to-br from-[#7B2020] to-[#3e0f0f] w-full h-full flex items-center justify-center p-8 z-10">
                  <div className="text-white">
                    <h2 className="text-2xl sm:text-4xl font-extrabold mb-4 drop-shadow-lg">Welcome to PDFMNHS</h2>
                    <p className="text-lg sm:text-2xl font-light drop-shadow">Online Management System</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events Mini-Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center text-gray-700">
              <h2 className="font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Upcoming Events
              </h2>
              <Link href="/admin/calendar" className="text-sm font-semibold text-[#5D1919] hover:underline">
                View Calendar &rarr;
              </Link>
            </div>
            <div>
              {loading ? (
                <p className="p-4 text-sm text-gray-400 italic text-center">Loading events...</p>
              ) : events.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 italic text-center">No upcoming events scheduled.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {events.map((ev) => {
                    const dateObj = schoolDate(ev.event_date);
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

        </div>

        {/* Right Column: Overview & Quick Actions (Stretches to match left column) */}
        <div className="flex flex-col gap-6 h-full">
          
          {/* System Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-100 text-gray-700">
              <h2 className="font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                System Overview
              </h2>
            </div>
            {/* flex-1 justify-center perfectly centers the grid in whatever space is remaining */}
            <div className="p-4 flex-1 flex flex-col justify-center">
              {loading && <p className="text-sm text-gray-400 italic text-center">Loading stats...</p>}
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
              {!loading && !error && data && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded border border-gray-100 text-center shadow-sm">
                    <p className="text-3xl font-extrabold text-[#5D1919]">{data.stats.total_learners}</p>
                    <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Learners</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100 text-center shadow-sm">
                    <p className="text-3xl font-extrabold text-[#5D1919]">{data.stats.total_faculty}</p>
                    <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Faculty</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100 text-center shadow-sm">
                    <p className="text-3xl font-extrabold text-[#5D1919]">{data.stats.enrolled_this_year}</p>
                    <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Enrolled S.Y.</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100 text-center shadow-sm">
                    <p className="text-3xl font-extrabold text-[#5D1919]">{data.stats.active_sections}</p>
                    <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Sections</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions (Pushed to the bottom) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 shrink-0">
            <div className="p-4 border-b border-gray-100 text-gray-700">
              <h2 className="font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Quick Actions
              </h2>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <Link href="/admin/accounts" className="w-full py-2.5 bg-[#3e0f0f] hover:bg-[#2a0a0a] transition text-white rounded text-center font-semibold text-sm shadow-sm flex justify-center items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                Add User
              </Link>
              <Link href="/admin/sections" className="w-full py-2.5 bg-[#1D4ED8] hover:bg-[#1e40af] transition text-white rounded text-center font-semibold text-sm shadow-sm flex justify-center items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                Manage Sections
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
