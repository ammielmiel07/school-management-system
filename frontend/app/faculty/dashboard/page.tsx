"use client";

import { apiFetch } from '@/lib/api';
import { useEffect, useState } from "react";
import AnnouncementCarousel from "@/components/AnnouncementCarousel";
import UpcomingEvents from "@/components/UpcomingEvents";

export default function FacultyDashboard() {
  const [facultyName, setFacultyName] = useState("");

  useEffect(() => {
    // You can update this endpoint later to fetch the specific faculty profile data
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await apiFetch("/api/faculty/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.faculty) {
          setFacultyName(`${data.faculty.first_name} ${data.faculty.last_name}`);
        }
      } catch {
        console.error("Failed to fetch profile info.");
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Welcome Banner */}
      <div className="bg-[#5D1919] text-white rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-wide">Welcome back, {facultyName || "Faculty Member"}!</h1>
        <p className="text-red-200 mt-1">Here are the latest announcements and upcoming events for Prudencia D. Fule Memorial National High School.</p>
      </div>

      {/* Announcements & Events Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        <div className="lg:col-span-2 flex flex-col h-full">
          <AnnouncementCarousel />
        </div>
        <div className="lg:col-span-1 flex flex-col h-full">
          <UpcomingEvents />
        </div>
      </div>

    </div>
  );
}