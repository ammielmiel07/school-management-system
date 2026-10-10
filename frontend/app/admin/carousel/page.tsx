"use client";

import { apiFetch } from '@/lib/api';
import { useEffect, useState, useRef } from "react";
import Image from "next/image";

interface CarouselImage {
  id: number;
  image_url: string;
  uploaded_at: string;
}

export default function ManageCarousel() {
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    try {
      const res = await apiFetch("/api/admin/carousel");
      const data = await res.json();
      if (res.ok) {
        setImages(data.images);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to fetch images.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG, JPG, or WebP image up to 5 MB.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch("/api/admin/carousel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
          // Note: Do NOT set Content-Type here; the browser sets it automatically with the boundary for FormData
        },
        body: formData,
      });

      const data = await res.json();
      
      if (res.ok) {
        setImages(current => [data.image, ...current]);
      } else {
        setError(data.error || "Upload failed.");
      }
    } catch {
      setError("Server error during upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await apiFetch(`/api/admin/carousel/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setImages(current => current.filter((img) => img.id !== id));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete.");
      }
    } catch {
      setError("Server error during deletion.");
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Manage Carousel</h1>
          <p className="text-gray-600 mt-1">Upload and manage banners for the dashboard announcement carousel.</p>
        </div>
        
        {/* Hidden File Input & Custom Upload Button */}
        <div>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading}
            className="bg-[#5D1919] hover:bg-[#3e0f0f] transition text-white font-bold py-2.5 px-6 rounded shadow-sm flex items-center gap-2 disabled:opacity-70"
          >
            {uploading ? "Uploading..." : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Upload New Image
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 font-semibold mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-500 italic py-12">Loading images...</p>
      ) : images.length === 0 ? (
        <div className="bg-white p-12 rounded-lg shadow-sm border text-center text-gray-500">
          No carousel images found. Click the upload button to add your first banner.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img) => (
            <div key={img.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden group">
              <div className="relative h-48 w-full bg-gray-100">
                <Image
                  fill unoptimized sizes="(max-width: 768px) 100vw, 33vw"
                  src={img.image_url}
                  alt="Carousel Banner" 
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-4 flex justify-between items-center border-t border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500 font-mono">
                  {new Date(img.uploaded_at).toLocaleDateString()}
                </span>
                <button 
                  onClick={() => handleDelete(img.id)}
                  className="text-red-600 hover:text-white border border-red-600 hover:bg-red-700 transition px-3 py-1 rounded text-xs font-bold uppercase tracking-wider"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
