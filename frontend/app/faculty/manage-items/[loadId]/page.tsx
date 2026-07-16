"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface GradeItem {
  id: number;
  component: string;
  item_name: string;
  max_score: string;
}

export default function ManageGradeItems() {
  const params = useParams();
  const router = useRouter();

  const [items, setItems] = useState<GradeItem[]>([]);
  const [trimester, setTrimester] = useState(1);
  const [loading, setLoading] = useState(true);

  // New Item Form State
  const [newItem, setNewItem] = useState({
    component: "WW",
    name: "",
    max: ""
  });

  const fetchItems = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/faculty/grade-items/${params.loadId}?trimester=${trimester}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch grade items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [params.loadId, trimester]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    try {
      const payload = {
        loadId: params.loadId,
        trimester,
        component: newItem.component,
        name: newItem.name,
        max: newItem.max
      };

      const res = await fetch("http://localhost:5000/api/faculty/grade-items", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setNewItem({ component: "WW", name: "", max: "" }); // Reset form
        fetchItems(); // Refresh list
      } else {
        alert("Failed to add grade item.");
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm("Are you sure? This will also delete ALL student scores encoded under this item!")) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/faculty/grade-items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchItems();
      } else {
        alert("Failed to delete item.");
      }
    } catch (err) {
      alert("Server error.");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Manage Grade Items</h1>
          <p className="text-gray-600 mt-1">Set up your Written Works, Performance Tasks, and Exams.</p>
        </div>
        <Link 
          href={`/faculty/my-classes/${params.loadId}`} 
          className="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 font-semibold transition"
        >
          &larr; Back to Gradebook
        </Link>
      </div>

      <div className="flex justify-center gap-2 mb-8">
        {[1, 2, 3].map((tri) => (
          <button
            key={tri}
            onClick={() => setTrimester(tri)}
            className={`px-6 py-2 border rounded font-bold shadow-sm transition-colors ${
              trimester === tri 
                ? "bg-[#5D1919] text-white border-[#5D1919]" 
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {tri === 1 ? "1st" : tri === 2 ? "2nd" : "3rd"} Trimester
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* ADD ITEM FORM */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 h-fit">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Add New Item</h2>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Component</label>
              <select 
                value={newItem.component}
                onChange={e => setNewItem({...newItem, component: e.target.value})}
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-red-900 bg-gray-50"
              >
                <option value="WW">Written Works (WW)</option>
                <option value="PT">Performance Tasks (PT)</option>
                <option value="EX">Quarterly Exam (EX)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Item Name</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Quiz 1, Recitation, Prelim"
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-red-900"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Highest Possible Score</label>
              <input 
                type="number" 
                required 
                min="1"
                placeholder="e.g. 20, 50, 100"
                value={newItem.max}
                onChange={e => setNewItem({...newItem, max: e.target.value})}
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-red-900"
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-green-700 text-white font-bold py-2 rounded shadow hover:bg-green-800 transition mt-2"
            >
              + Create Item
            </button>
          </form>
        </div>

        {/* ITEMS TABLE */}
        <div className="md:col-span-2 bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          {loading ? (
            <p className="p-8 text-center text-gray-500">Loading items...</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#5D1919] text-white text-sm font-bold uppercase tracking-wider">
                  <th className="p-3">Component</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3 text-center">Max Score</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500 italic">No items created for this trimester yet.</td>
                  </tr>
                ) : (
                  items.map(item => (
                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-600">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.component === 'WW' ? 'bg-blue-100 text-blue-800' : 
                          item.component === 'PT' ? 'bg-green-100 text-green-800' : 
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {item.component}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-gray-800">{item.item_name}</td>
                      <td className="p-3 text-center font-mono font-bold text-gray-700">{item.max_score}</td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold px-2 py-1 rounded transition text-xs border border-transparent hover:border-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}