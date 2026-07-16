"use client";

import { useEffect, useState } from "react";

export default function FacultyDashboard() {
  const [username, setUsername] = useState("");

  useEffect(() => {
    // Grab the logged-in username (which is their Employee No.)
    setUsername(localStorage.getItem("username") || "Faculty");
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
          <h1 className="text-3xl font-bold text-blue-900 mb-4">Welcome, Teacher {username}!</h1>
          <p className="text-gray-600 text-lg mb-6">
            Welcome to your Faculty Portal. From here, you can manage your assigned classes, 
            view your advisory section, and encode grades for the current school year.
          </p>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-blue-800 font-medium">
              <span className="font-bold">Getting Started:</span> Use the blue sidebar on the left to navigate to "My Classes" to see your teaching load.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}