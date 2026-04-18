"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Crown } from "lucide-react";
import { getSafeImageUrl } from "@/lib/utils";

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
            imageUrl: doc.imageUrls?.[0] || doc.imageUrl || "/Logo3.png",
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
              style={{ height: "160px" }}
            />
          ))
        ) : (
          premiumLocales.map((local) => {
            const bgImage = getSafeImageUrl(local.imagenTarjeta || local.imageUrl);
            const logoSrc = local.logoHeader ? getSafeImageUrl(local.logoHeader) : null;

            return (
              <div
                key={local.id}
                className="min-w-[260px] max-w-[260px] shrink-0 rounded-2xl overflow-hidden relative flex flex-col justify-between snap-start"
                style={{
                  minHeight: "160px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                  background: "linear-gradient(135deg, #111111 0%, #2a2412 60%, #1a1a0e 100%)",
                }}
              >
                {/* ── Imagen de fondo ─────────────────────────────────── */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${bgImage})`,
                    opacity: 0.22,
                  }}
                />

                {/* ── Gradiente para legibilidad ──────────────────────── */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 100%)",
                  }}
                />

                {/* ── Borde dorado sutil ──────────────────────────────── */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(212,175,55,0.35)" }}
                />

                {/* ── Logo en esquina superior derecha ────────────────── */}
                {logoSrc && (
                  <div className="relative z-10 flex justify-end p-3 pb-0">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        background: "rgba(0,0,0,0.45)",
                        backdropFilter: "blur(6px)",
                        borderRadius: "10px",
                        padding: "5px 8px",
                        maxWidth: "96px",
                        height: "36px",
                      }}
                    >
                      <img
                        src={logoSrc}
                        alt={local.businessName}
                        style={{
                          maxWidth: "80px",
                          maxHeight: "26px",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",  // ← preserva proporciones logos anchos
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Contenido inferior ──────────────────────────────── */}
                <div className="relative z-10 p-4 pt-2 space-y-1.5">
                  {/* Badge PATROCINADO */}
                  <div>
                    <span
                      className="inline-block rounded-full font-semibold uppercase tracking-wider"
                      style={{
                        background: "#D4AF37",
                        color: "#3D2B00",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 10px",
                      }}
                    >
                      ✦ Patrocinado
                    </span>
                  </div>

                  {/* Nombre del local */}
                  <h4
                    className="text-white leading-tight line-clamp-1"
                    style={{ fontSize: "16px", fontWeight: 700 }}
                  >
                    {local.businessName}
                  </h4>

                  {/* Texto promocional */}
                  <p
                    className="leading-snug"
                    style={{
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.72)",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {local.promoText || "¡Descúbrela hoy en el Patio Curauma!"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
