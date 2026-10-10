"use client";

import { apiFetch } from '@/lib/api';
import { useEffect, useState } from "react";
import Link from "next/link";

interface Load {
  id: number;
  subject_name: string;
  section_name: string;
  grade_level: number;
}

export default function MyClasses() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoads = async () => {
      const token = localStorage.getItem("token");
      try {
        const response = await apiFetch("/api/faculty/my-classes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setLoads(data.loads);
        }
      } catch {
        console.error("Failed to load classes");
      } finally {
        setLoading(false);
      }
    };
    fetchLoads();
  }, []);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">My Classes</h1>
      
      {loading ? (
        <p>Loading your teaching loads...</p>
      ) : loads.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded text-yellow-800">
          No classes assigned to you for this school year. Please contact the Admin.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loads.map((load) => (
            <div key={load.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-600 hover:shadow-lg transition">
              <h2 className="text-xl font-bold text-gray-800">{load.subject_name}</h2>
              <p className="text-gray-600 mt-2 font-medium">Grade {load.grade_level} - {load.section_name}</p>
                <Link href={`/faculty/my-classes/${load.id}`}
                    className="mt-4 w-full block text-center bg-blue-900 text-white py-2 rounded hover:bg-blue-800 font-semibold transition"
                >
                View Gradebook
                </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}