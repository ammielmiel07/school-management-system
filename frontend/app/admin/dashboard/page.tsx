"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [message, setMessage] = useState("Loading secure data...");
  const [userData, setUserData] = useState<{ id?: number; username?: string; role_id?: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // 1. Grab the VIP pass from local storage
    const token = localStorage.getItem("token");

    // 2. If they don't have a token, kick them back to the login page!
    if (!token) {
      router.push("/login");
      return;
    }

    // 3. If they DO have a token, show it to the backend's bouncer
    const fetchSecureData = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/admin/dashboard", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`, // Presenting the token
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (response.ok) {
          setMessage(data.message);
          setUserData(data.user_data);
        } else {
          // If the token is expired or fake, clear it and kick them out
          localStorage.removeItem("token");
          router.push("/login");
        }
      } catch (err) {
        setMessage("Failed to connect to the server.");
      }
    };

    fetchSecureData();
  }, [router]);

  // A simple logout function
  const handleLogout = () => {
    localStorage.removeItem("token"); // Rip up the VIP pass
    router.push("/login"); // Send them to the login screen
  };

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Welcome back, Super Admin</h1>
        
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r">
          <p className="text-blue-700 font-semibold">{message}</p>
        </div>

        {userData && (
          <div className="bg-gray-50 p-4 rounded border border-gray-100">
            <h2 className="text-lg font-bold mb-2 text-gray-700">Your Profile Data:</h2>
            <p className="text-gray-600"><strong>User ID:</strong> {userData.id}</p>
            <p className="text-gray-600"><strong>Role ID:</strong> {userData.role_id} (Super Admin)</p>
          </div>
        )}
      </div>
    </div>
  );
}