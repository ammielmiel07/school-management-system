"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // We use this to redirect the user after login

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""); // Stores any error messages from the backend
  const router = useRouter(); 

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear previous errors

    try {
      // 1. Send the data to your Node.js backend
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      // 2. Parse the backend's response
      const data = await response.json();

      if (response.ok) {
        // 3. Success! Save the VIP pass (JWT token) AND user details into local storage
        localStorage.setItem("token", data.token);
        
        // Save the role_id and username so the layouts know who is logged in!
        localStorage.setItem("role_id", data.user.role_id.toString());
        localStorage.setItem("username", data.user.username);
        
        // Smart Routing based on Role ID
        const userRole = data.user.role_id; 

        if (userRole === 1) {
          router.push("/admin/dashboard"); // Send Super Admins to the Maroon Portal
        } else if (userRole === 2) {
          router.push("/faculty/dashboard"); // Send Faculty to the Blue Portal
        } else if (userRole === 3) {
          router.push("/learner/dashboard");
        } else if (userRole === 4) {
          router.push("/parent/dashboard");
        } else {
          router.push("/login"); // Fallback just in case
        }
      } else {
        // If the backend sends back a 401 Unauthorized, show the error message
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Cannot connect to the server. Is your backend running?");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">School Portal</h2>
        
        {/* If there is an error, display it in a red box */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition duration-200"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
