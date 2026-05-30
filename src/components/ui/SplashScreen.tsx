"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
        "splash-failsafe fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-all duration-700 ease-in-out",
        fade ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      )}
    >
      <div className="flex flex-col items-center animate-in zoom-in-95 duration-1000 ease-out">
        <Image
          src="/Logo3.webp"
          alt="Patio Curauma"
          width={224}
          height={224}
          priority
          className="object-contain drop-shadow-md"
        />
        {/* Indicador de carga sutil */}
        <div className="mt-12 flex gap-2 items-center">
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#CCCCCC", transition: "all 0.3s ease", flexShrink: 0 }} />
          <div style={{ width: "24px", height: "8px", borderRadius: "4px", background: "#C9920A", transition: "all 0.3s ease", flexShrink: 0 }} />
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#CCCCCC", transition: "all 0.3s ease", flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}
