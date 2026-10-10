"use client";

import { apiFetch } from '@/lib/api';
import { useEffect, useState } from "react";
import Image from "next/image";

interface CarouselImage {
  id: number;
  image_url: string;
}

export default function AnnouncementCarousel() {
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const res = await apiFetch("/api/admin/carousel");
        const data = await res.json();
        if (res.ok && data.images) {
          setCarouselImages(data.images);
        }
      } catch {
        console.error("Failed to load carousel images.");
      }
    };
    fetchImages();
  }, []);

  useEffect(() => {
    if (carouselImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000); 
    return () => clearInterval(interval);
  }, [carouselImages.length]);

  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % carouselImages.length);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center text-gray-700 bg-white">
        <h2 className="font-bold flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
          Announcements
        </h2>
        <span className="text-xs uppercase font-semibold text-gray-400">Carousel</span>
      </div>
      
      <div className="relative bg-gray-900 w-full aspect-video flex items-center justify-center text-center overflow-hidden group flex-1">
        {carouselImages.length > 0 ? (
          <>
            {carouselImages.map((img, index) => (
              <div key={img.id} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                <Image src={img.image_url} alt={`Announcement ${index + 1}`} fill unoptimized sizes="(max-width: 768px) 100vw, 70vw" className="object-cover" />
              </div>
            ))}
            {carouselImages.length > 1 && (
              <>
                <button aria-label="Previous announcement" onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-5xl transition md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 drop-shadow-md z-20">&lsaquo;</button>
                <button aria-label="Next announcement" onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-5xl transition md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 drop-shadow-md z-20">&rsaquo;</button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {carouselImages.map((_, i) => (
                    <button key={i} aria-label={`Show announcement ${i + 1}`} aria-pressed={i === currentSlide} onClick={() => setCurrentSlide(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`} />
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
  );
}
