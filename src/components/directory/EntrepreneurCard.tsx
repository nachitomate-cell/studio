
"use client";

import Image from "next/image";
import { Entrepreneur } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn, getSafeImageUrl } from "@/lib/utils";
import { formatDistance } from "@/hooks/useUserLocation";
import { registrarEvento } from "@/lib/statsLocal";
import { Star } from "lucide-react";

interface EntrepreneurCardProps {
  entrepreneur: Entrepreneur;
  fullWidth?: boolean;
  isOpen?: boolean | null;
  distanceKm?: number;
  priority?: boolean;
  averageRating?: number;
  reviewCount?: number;
}


export function EntrepreneurCard({ entrepreneur, fullWidth = false, isOpen, distanceKm, priority = false, averageRating, reviewCount }: EntrepreneurCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(getSafeImageUrl(entrepreneur.imagenTarjeta || entrepreneur.imageUrl));
  const ref = useRef<HTMLAnchorElement>(null);

  // Aparición en el directorio: cuenta cuando al menos la mitad de la tarjeta
  // queda en pantalla (no por estar en la lista sin que nadie la vea).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        registrarEvento(entrepreneur.id, "impresion");
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [entrepreneur.id]);

  return (
    <Link ref={ref} href={`/emprendedor/${entrepreneur.id}`} className="block group">
      <Card className="overflow-hidden border border-gray-100 bg-white shadow-sm hover:shadow-xl transition-all duration-300 rounded-[24px] group-hover:-translate-y-0.5">
        <div className={cn("relative w-full overflow-hidden bg-slate-50", fullWidth ? "aspect-[16/7]" : "aspect-square")}>
          {!imageLoaded && (
            <div className="absolute inset-0 bg-slate-200 animate-pulse z-0" />
          )}
          <Image
            src={imgSrc}
            alt={entrepreneur.name}
            fill
            sizes={fullWidth ? "(max-width: 512px) 100vw, 512px" : "(max-width: 512px) 50vw, 256px"}
            quality={75}
            priority={priority}
            className={cn(
              "object-cover group-hover:scale-105 transition-all duration-700 z-10",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => { setImgSrc("/Logo2.png"); setImageLoaded(false); }}
            data-ai-hint="business photo"
          />
          {/* Badge de rubro */}
          {entrepreneur.category && (
            <div
              className="absolute"
              style={{ top: "10px", left: "10px" }}
            >
              <span
                style={{
                  background: "rgba(0,0,0,0.55)",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "20px",
                  padding: "4px 10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "inline-block",
                }}
              >
                {entrepreneur.category}
              </span>
            </div>
          )}
          {/* Badge patrocinador — solo para locales isPremium */}
          {entrepreneur.isPremium && (
            <span
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.92)",
                color: "#92400E",
                backdropFilter: "blur(4px)",
              }}
            >
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              Patrocinado
            </span>
          )}
          {/* Badge open/closed — bottom-left of image */}
          {isOpen === true && (
            <span
              className="absolute bottom-2 left-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(0,0,0,0.55)", color: "#4ade80", backdropFilter: "blur(4px)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Abierto
            </span>
          )}
          {isOpen === false && (
            <span
              className="absolute bottom-2 left-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(0,0,0,0.55)", color: "#94a3b8", backdropFilter: "blur(4px)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
              Cerrado
            </span>
          )}
        </div>
        <CardContent className="p-3 text-center bg-white border-t border-slate-50">
          {/* Dos líneas con alto fijo: en una sola los nombres quedaban en "POMARUS..." */}
          <h3 className="text-xs font-bold text-[#4A4A4A] line-clamp-2 leading-snug min-h-[2.75em] group-hover:text-[#C9920A] transition-colors">
            {entrepreneur.name}
          </h3>
          <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
            {distanceKm !== undefined && (
              <p className="text-[10px] text-slate-400">📍 {formatDistance(distanceKm)}</p>
            )}
            {averageRating !== undefined && reviewCount !== undefined && reviewCount > 0 && (
              <div className="flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                <span className="text-[10px] font-bold text-slate-500">{averageRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
