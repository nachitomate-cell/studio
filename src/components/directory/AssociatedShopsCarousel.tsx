"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSafeImageUrl } from "@/lib/utils";

export interface ShopBasicInfo {
  id: string;
  businessName?: string;
  nombre?: string;
  category?: string;
  rubro?: string;
  imageUrls?: string[];
  imagenUrl?: string;
  imagenPerfil?: string;
}

interface Props {
  shops: ShopBasicInfo[];
  isLoading?: boolean;
}

export function AssociatedShopsCarousel({ shops, isLoading }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);

  // Lógica de Auto-Scroll Seguro con RequestAnimationFrame
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isInteracting || isLoading || !shops || shops.length === 0) return;

    let lastTime = performance.now();
    const speed = 0.05; // Pixels por milisegundo
    let exactScrollLeft = el.scrollLeft; // Almacenamos el valor exacto con decimales

    const scrollStep = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;

      if (el) {
        exactScrollLeft += speed * delta;
        el.scrollLeft = Math.floor(exactScrollLeft);

        // Bucle Infinito: Si el scrollLeft alcanza el final, volver al inicio
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
          el.scrollLeft = 0;
          exactScrollLeft = 0;
        }
      }
      rafRef.current = requestAnimationFrame(scrollStep);
    };

    rafRef.current = requestAnimationFrame(scrollStep);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isInteracting, isLoading, shops]);

  // Freno de Mano (Pausa de interacción)
  const handleInteractionStart = () => {
    setIsInteracting(true);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  };

  const handleInteractionEnd = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 2000);
  };

  // Skeleton
  if (isLoading) {
    return (
      <div className="grid grid-rows-2 grid-flow-col gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide px-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={`loading-${i}`}
            className="snap-center shrink-0 w-[260px] h-[200px] bg-slate-700/50 rounded-2xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!shops || shops.length === 0) {
    return null;
  }

  // Multiplicamos el array para dar un margen suficiente de "bucle infinito" visual
  const infiniteShops = [...shops, ...shops, ...shops];

  return (
    <div
      ref={scrollRef}
      className={`grid grid-rows-2 grid-flow-col gap-4 overflow-x-auto pb-4 scrollbar-hide px-4 ${
        isInteracting ? "snap-x snap-mandatory" : ""
      }`}
      style={{ touchAction: "pan-x pan-y" }}
      onTouchStart={handleInteractionStart}
      onTouchEnd={handleInteractionEnd}
      onMouseEnter={handleInteractionStart}
      onMouseLeave={handleInteractionEnd}
    >
      {infiniteShops.map((shop, index) => {
        const imageSrc =
          shop.imagenPerfil ||
          shop.imagenUrl ||
          shop.imageUrls?.[0] ||
          "/Logo2.png";

        const name = shop.businessName || shop.nombre || "Local del Patio";
        const category = shop.category || shop.rubro || "General";

        return (
          <Link
            key={`${shop.id}-${index}`}
            href={`/emprendedor/${shop.id}`}
            className="snap-center shrink-0 w-[260px] block bg-slate-800 rounded-2xl overflow-hidden shadow-md active:scale-95 transition-transform duration-200"
          >
            {/* Image Section */}
            <div className="w-full h-32 bg-slate-700 relative">
              <img
                src={getSafeImageUrl(imageSrc)}
                alt={name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
            </div>
            
            {/* Content Section */}
            <div className="p-4 relative mt-[-20px]">
              <h3 className="font-bold text-white text-base truncate mb-1">
                {name}
              </h3>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary/20 text-primary border border-primary/30">
                {category}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
