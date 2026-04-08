"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function SplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // A los 1.5s empezamos a desvanecer
    const fadeTimer = setTimeout(() => {
      setFade(true);
    }, 1500);

    // A los 2.2s removemos el componente del DOM completamente
    const unmountTimer = setTimeout(() => {
      setMounted(false);
    }, 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-all duration-700 ease-in-out",
        fade ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      )}
    >
      <div className="flex flex-col items-center animate-in zoom-in-95 duration-1000 ease-out">
        <img 
          src="/Logo.png" 
          alt="Patio Curauma" 
          className="w-56 object-contain drop-shadow-md" 
        />
        {/* Indicador de carga sutil */}
        <div className="mt-12 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
