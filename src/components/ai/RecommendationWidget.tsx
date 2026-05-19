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
  promoText?: string;
}

export function RecommendationWidget() {
  const [premiumLocales, setPremiumLocales] = useState<PremiumLocal[]>([]);
  const [loading, setLoading] = useState(true);

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
            promoText: doc.promoText || undefined,
          };
        });
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
            // Misma lógica que EntrepreneurCard del directorio: imagenTarjeta || imageUrl
            // logoHeader NO se usa aquí — no lo actualiza el formulario de /directorio
            const heroSrc = getSafeImageUrl(local.imagenTarjeta || local.imageUrl);

            return (
              <Link
                key={local.id}
                href={`/emprendedor/${local.id}`}
                className="group min-w-[260px] max-w-[260px] shrink-0 rounded-2xl overflow-hidden relative flex flex-col justify-end snap-start transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
                style={{ height: "200px" }}
              >
                {/* Fondo base oscuro */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(140deg, #0d1117 0%, #1a1f2e 50%, #0d1117 100%)",
                  }}
                />

                {/* Borde dorado sutil */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(212,175,55,0.35)" }}
                />

                {/* Panel de metal cepillado — unifica cualquier fondo de logo */}
                <div className="absolute inset-x-8 top-6 flex items-center justify-center p-4 border border-neutral-700/50 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 shadow-inner aspect-[3/1.5]">
                  <img
                    src={heroSrc}
                    alt={local.businessName}
                    className="h-12 w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Gradiente inferior para legibilidad del texto */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Textos sutiles */}
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

                  <p className="leading-snug line-clamp-1 overflow-hidden text-[11px] text-neutral-400">
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
