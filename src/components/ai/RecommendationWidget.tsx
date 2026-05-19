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
  imageUrl: string;        // fallback universal
  imagenTarjeta?: string;  // fondo de la tarjeta del carrusel
  logoHeader?: string;     // logo/marca visible en la esquina superior
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
            logoHeader: doc.logoHeader || undefined,
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
            const bgImage = getSafeImageUrl(local.imagenTarjeta || local.imageUrl);
            const logoSrc = local.logoHeader ? getSafeImageUrl(local.logoHeader) : null;

            return (
              <Link
                key={local.id}
                href={`/emprendedor/${local.id}`}
                className="group min-w-[260px] max-w-[260px] shrink-0 rounded-2xl overflow-hidden relative flex flex-col justify-end snap-start transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]"
                style={{ height: "200px" }}
              >
                {/* ── 1. Imagen de fondo a full opacidad ──────────────── */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-in-out group-hover:scale-105"
                  style={{ backgroundImage: `url(${bgImage})` }}
                />

                {/* ── 2. Gradiente: oscuro abajo → transparente arriba ── */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />

                {/* ── Borde dorado sutil ──────────────────────────────── */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ boxShadow: "inset 0 0 0 1.5px rgba(212,175,55,0.5)" }}
                />

                {/* ── 3. Insignia del logo — top-right ────────────────── */}
                {logoSrc && (
                  <div className="absolute top-3 right-3 z-10">
                    <div
                      className="flex items-center justify-center rounded-xl shadow-lg"
                      style={{
                        background: "rgba(255,255,255,0.96)",
                        backdropFilter: "blur(8px)",
                        padding: "5px 9px",
                        maxWidth: "90px",
                        height: "38px",
                      }}
                    >
                      <img
                        src={logoSrc}
                        alt={local.businessName}
                        style={{
                          maxWidth: "72px",
                          maxHeight: "26px",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ── 4. Contenido inferior ───────────────────────────── */}
                <div className="relative z-10 p-4 space-y-1">
                  {/* 2. Badge PATROCINADO — outlined accesible */}
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-black/35 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "#F5C842" }}
                  >
                    ✦ Patrocinado
                  </span>

                  {/* Nombre del local */}
                  <h4
                    className="text-white font-bold leading-tight line-clamp-1"
                    style={{ fontSize: "16px" }}
                  >
                    {local.businessName}
                  </h4>

                  {/* 4. Texto promocional — line-clamp consistente */}
                  <p
                    className="leading-snug line-clamp-2 overflow-hidden"
                    style={{ fontSize: "12px", color: "rgba(255,255,255,0.78)" }}
                  >
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
