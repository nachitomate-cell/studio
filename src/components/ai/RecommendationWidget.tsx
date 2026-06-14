"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Crown } from "lucide-react";
import { getSafeImageUrl } from "@/lib/utils";
import Link from "next/link";

interface PremiumLocal {
  id: string;
  businessName: string;
  category: string;
  imageUrl: string;
  imagenTarjeta?: string;
  logoHeader?: string;
  promoText?: string;
}

// Cache de módulo — persiste entre navegaciones sin re-fetches
let _premiumCache: PremiumLocal[] | null = null;

export function RecommendationWidget() {
  const [premiumLocales, setPremiumLocales] = useState<PremiumLocal[]>(_premiumCache ?? []);
  const [loading, setLoading] = useState(_premiumCache === null);

  useEffect(() => {
    const q = query(
      collection(db, "entrepreneur_profiles"),
      where("isPremium", "==", true)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: PremiumLocal[] = snap.docs.map((d) => {
          const doc = d.data();
          return {
            id: d.id,
            businessName: doc.businessName || doc.nombre || "Local Destacado",
            category: doc.category || doc.rubro || "",
            imageUrl: doc.imageUrls?.[0] || doc.imageUrl || "/Logo2.png",
            imagenTarjeta: doc.imagenTarjeta || undefined,
            logoHeader: doc.logoHeader || undefined,
            promoText: doc.promoText || undefined,
          };
        });
        _premiumCache = data;
        setPremiumLocales(data);
        setLoading(false);
      },
      (error) => {
        console.error("[RecommendationWidget] Error cargando destacados:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  if (!loading && premiumLocales.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Título */}
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-amber-500" />
        <h3 className="text-base font-black text-slate-800 tracking-tight">
          Destacados del Patio
        </h3>
      </div>

      {/* Carrusel horizontal — swipeable en móvil */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar scroll-smooth snap-x snap-mandatory">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="min-w-[260px] shrink-0 rounded-2xl bg-slate-200 animate-pulse snap-start"
              style={{ height: "200px" }}
            />
          ))
        ) : (
          premiumLocales.map((local) => {
            const heroSrc = getSafeImageUrl(local.imagenTarjeta || local.imageUrl);
            const logoSrc = local.logoHeader ? getSafeImageUrl(local.logoHeader) : null;

            return (
              <Link
                key={local.id}
                href={`/emprendedor/${local.id}`}
                className="group min-w-[260px] max-w-[260px] shrink-0 rounded-2xl overflow-hidden relative flex flex-col justify-end snap-start transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
                style={{ height: "200px" }}
              >
                {/* Imagen de fondo — cubre todo el cuadro */}
                <img
                  src={heroSrc}
                  alt={local.businessName}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/Logo2.png"; }}
                />

                {/* Gradiente inferior para legibilidad del texto */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                {/* Borde dorado sutil */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(212,175,55,0.35)" }}
                />

                {/* Logo superpuesto — visible al 100% en esquina superior derecha */}
                {logoSrc && (
                  <div className="absolute top-2.5 right-2.5 w-14 h-14 rounded-xl overflow-hidden bg-white/15 backdrop-blur-md p-1.5 shadow-lg">
                    <img
                      src={logoSrc}
                      alt={`Logo ${local.businessName}`}
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}

                {/* Textos en la parte inferior */}
                <div className="relative z-10 px-3 pb-3 space-y-0.5">
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/60 bg-black/30 backdrop-blur-sm px-2 py-px text-[9px] font-semibold uppercase tracking-widest"
                    style={{ color: "#F5C842" }}
                  >
                    ✦ Patrocinado
                  </span>

                  <h4 className="text-white/90 font-semibold leading-tight line-clamp-1 text-sm">
                    {local.businessName}
                  </h4>

                  <p className="leading-snug line-clamp-1 overflow-hidden text-[11px] text-neutral-300">
                    {local.promoText || "¡Descúbrela hoy en el Patio Curauma!"}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
