"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Map, Loader2, X, ChevronRight, HelpCircle } from "lucide-react";
import { isVendorVisible } from "@/lib/utils";

// ── Real-time hook ────────────────────────────────────────────────────────────
// Listens to the user's sellosLocales map so stamps illuminate the instant
// a sale is confirmed (either via pending_stamps handshake or vendor-scan).
function useLocalesVisitados(userId: string | null): Record<string, number> {
  const [sellosLocales, setSellosLocales] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "usuarios", userId), (snap) => {
      if (snap.exists()) {
        setSellosLocales(snap.data().sellosLocales || {});
      }
    });
    return () => unsub();
  }, [userId]);

  return sellosLocales;
}

// ── Stamp state ───────────────────────────────────────────────────────────────
type StampState = "inactive" | "active" | "frequent";

function getStampState(count: number): StampState {
  if (count <= 0) return "inactive";
  if (count >= 5) return "frequent"; // completed at least one full loyalty card
  return "active";
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ visited, total }: { visited: number; total: number }) {
  const pct = total > 0 ? Math.round((visited / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600">Locales descubiertos</span>
        <span className="text-xs font-black" style={{ color: "#D3B673" }}>
          {visited} / {total}
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #D3B673 0%, #8DC63F 100%)",
          }}
        />
      </div>
      <p className="text-[10px] text-slate-400 font-medium text-right">{pct}% del álbum completado</p>
    </div>
  );
}

// ── Stamp cell ────────────────────────────────────────────────────────────────
function StampCell({
  vendor,
  stampCount,
  onTapInactive,
}: {
  vendor: any;
  stampCount: number;
  onTapInactive: () => void;
}) {
  const state = getStampState(stampCount);
  const isFrequent = state === "frequent";
  const isActive = state === "active";
  const isInactive = state === "inactive";

  return (
    <div
      className="flex flex-col items-center gap-2"
      onClick={() => isInactive && onTapInactive()}
    >
      {/* Stamp frame */}
      <div
        className={`w-full aspect-square rounded-2xl border-2 flex items-center justify-center p-1.5 relative overflow-hidden transition-all duration-500 ${
          isInactive
            ? "border-dashed border-slate-200 bg-slate-50 cursor-pointer active:bg-slate-100"
            : isFrequent
            ? "border-[#D3B673] bg-white"
            : "border-primary/30 bg-white shadow-sm"
        }`}
        style={
          isFrequent
            ? { boxShadow: "0 0 20px 4px rgba(211,182,115,0.30), 0 2px 8px rgba(0,0,0,0.08)" }
            : {}
        }
      >
        <img
          src={vendor.imageUrl}
          alt={vendor.name}
          className="w-full h-full object-cover rounded-xl transition-all duration-500"
          style={{
            filter: isInactive
              ? "grayscale(100%) opacity(0.4)"
              : isFrequent
              ? "drop-shadow(0 2px 8px rgba(211,182,115,0.45))"
              : "none",
            transform: isInactive ? "scale(0.95)" : "scale(1)",
          }}
        />

        {/* Inset shadow overlay */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_8px_rgba(0,0,0,0.05)]" />

        {/* Stamp count badge */}
        {!isInactive && (
          <div
            className={`absolute -bottom-2 -right-2 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
              isFrequent ? "" : "bg-primary"
            }`}
            style={{ backgroundColor: isFrequent ? "#D3B673" : undefined }}
          >
            {stampCount}
          </div>
        )}

        {/* Frequent star */}
        {isFrequent && (
          <div
            className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
            style={{ backgroundColor: "#D3B673" }}
          >
            <span style={{ fontSize: 8, lineHeight: 1 }}>⭐</span>
          </div>
        )}
      </div>

      {/* Label */}
      <p
        className="text-[10px] text-center font-bold leading-tight line-clamp-2 transition-colors duration-300"
        style={{
          color: isFrequent ? "#C9920A" : isActive ? "#334155" : "#94a3b8",
        }}
      >
        {vendor.name}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MiRutaPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entrepreneurs, setEntrepreneurs] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [showRouteInfo, setShowRouteInfo] = useState(false);

  // Real-time stamp data — auto-updates when any sale is confirmed
  const sellosLocales = useLocalesVisitados(userId);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/?login=true");
        return;
      }
      setUserId(user.uid);

      // One-time fetch of profiles (relatively static data)
      const profilesSnap = await getDocs(collection(db, "entrepreneur_profiles"));
      const vendors = profilesSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.businessName || data.nombre || "Local Aliado",
            imageUrl:
              data.imageUrls?.[0] ||
              data.imagenUrl ||
              data.imagenPerfil ||
              data.imagenTarjeta ||
              "/Logo2.png",
            category: data.category || data.rubro || null,
            description: data.description || data.descripcion || "",
            ...data,
          };
        })
        .filter((v) => isVendorVisible(v as any))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      setEntrepreneurs(vendors);
      setLoading(false);
    });

    return () => unsubAuth();
  }, [router]);

  // Unique categories (sorted, non-null)
  const categories = useMemo(() => {
    const cats = new Set(
      entrepreneurs.map((v) => v.category).filter(Boolean) as string[]
    );
    return Array.from(cats).sort();
  }, [entrepreneurs]);

  // Filtered list
  const filteredVendors = useMemo(
    () =>
      activeCategory
        ? entrepreneurs.filter((v) => v.category === activeCategory)
        : entrepreneurs,
    [entrepreneurs, activeCategory]
  );

  // Visited count (real-time derived)
  const visitedCount = useMemo(
    () => entrepreneurs.filter((v) => (sellosLocales[v.id] || 0) > 0).length,
    [entrepreneurs, sellosLocales]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-24 font-sans animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-5 sticky top-0 z-10 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="text-slate-400 shrink-0"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-slate-800">Mi Ruta</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Álbum de Estampillas
          </p>
        </div>
        <button
          onClick={() => setShowRouteInfo(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="¿Cómo funciona?"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline">¿Cómo funciona?</span>
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">

        {/* Progress card */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(211,182,115,0.12)" }}
            >
              <Map className="w-5 h-5" style={{ color: "#D3B673" }} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">Álbum del Patio</h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Visita cada local para iluminar su estampilla
              </p>
            </div>
          </div>
          <ProgressBar visited={visitedCount} total={entrepreneurs.length} />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-200" />
            Sin visitar
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary" />
            Visitado
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#D3B673" }} />
            Frecuente (5+)
          </div>
        </div>

        {/* Category filters */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                activeCategory === null
                  ? "text-white border-transparent shadow-sm"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
              style={activeCategory === null ? { backgroundColor: "#D3B673", borderColor: "#D3B673" } : {}}
            >
              Todos
            </button>
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(isActive ? null : cat)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                    isActive
                      ? "text-white border-transparent shadow-sm"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                  style={isActive ? { backgroundColor: "#D3B673", borderColor: "#D3B673" } : {}}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Stamp grid */}
        {filteredVendors.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {filteredVendors.map((vendor) => (
              <StampCell
                key={vendor.id}
                vendor={vendor}
                stampCount={sellosLocales[vendor.id] || 0}
                onTapInactive={() => setSelectedVendor(vendor)}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-400 italic">
            No hay locales en esta categoría.
          </div>
        )}
      </div>

      {/* Route info modal */}
      {showRouteInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-5"
          onClick={() => setShowRouteInfo(false)}
        >
          <div
            className="w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
            style={{ background: "#0F172A" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header strip */}
            <div
              className="px-7 pt-8 pb-6"
              style={{ background: "linear-gradient(135deg, #C9920A22 0%, #8DC63F11 100%)" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ backgroundColor: "rgba(211,182,115,0.15)" }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>🗺️</span>
              </div>
              <h2 className="text-xl font-black text-white leading-snug">
                Tu Pasaporte<br />Patio Curauma
              </h2>
            </div>

            {/* Body */}
            <div className="px-7 py-6 space-y-4">
              {/* Main explanation */}
              <div className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">⭐</span>
                <p className="text-sm text-slate-300 leading-relaxed">
                  ¡Esta es tu colección personal de aventuras! Cada vez que compras y
                  recibes un sello en un local del Patio, su estampilla se{" "}
                  <span className="font-bold text-white">iluminará a color</span> en esta pantalla.
                </p>
              </div>

              {/* Challenge */}
              <div className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">🏆</span>
                <p className="text-sm text-slate-300 leading-relaxed">
                  <span className="font-bold text-white">El Reto:</span> ¿Podrás completar toda la ruta?
                  Visita nuevos emprendimientos, conoce a nuestros vecinos y llena tu álbum de experiencias.
                </p>
              </div>

              {/* Tip */}
              <div
                className="flex gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: "rgba(211,182,115,0.08)", border: "1px solid rgba(211,182,115,0.2)" }}
              >
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <p className="text-[12px] text-slate-400 leading-relaxed">
                  Las estampillas en gris son locales que aún te falta descubrir.
                  Toca cualquiera para ver más info y animarte a visitarlos.
                </p>
              </div>

              {/* States legend */}
              <div className="space-y-2 pt-1">
                {[
                  { dot: "#94a3b8", label: "Aún no visitado", sub: "Gris, esperando tu primera visita" },
                  { dot: "#4ade80", label: "Visitado", sub: "Color completo · contador de sellos" },
                  { dot: "#D3B673", label: "Frecuente (5+ sellos)", sub: "Brillo dorado · tarjeta completada" },
                ].map(({ dot, label, sub }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                    <div>
                      <p className="text-[11px] font-bold text-white">{label}</p>
                      <p className="text-[10px] text-slate-500">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="px-7 pb-7">
              <button
                onClick={() => setShowRouteInfo(false)}
                className="w-full h-12 rounded-2xl font-black text-sm transition-all active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg, #C9920A 0%, #E8B028 100%)", color: "#fff" }}
              >
                ¡Vamos a recorrer! 🗺️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inactive vendor tooltip modal */}
      {selectedVendor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedVendor(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl p-7 space-y-5 animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

            {/* Vendor preview */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 shrink-0 bg-slate-50">
                <img
                  src={selectedVendor.imageUrl}
                  alt={selectedVendor.name}
                  className="w-full h-full object-cover grayscale opacity-50"
                />
              </div>
              <div className="min-w-0">
                {selectedVendor.category && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {selectedVendor.category}
                  </p>
                )}
                <h3 className="text-lg font-black text-slate-800 truncate">
                  {selectedVendor.name}
                </h3>
              </div>
            </div>

            {selectedVendor.description ? (
              <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">
                {selectedVendor.description}
              </p>
            ) : null}

            <p className="text-sm font-medium text-slate-400">
              Aún no has visitado este local.{" "}
              <span className="font-bold text-slate-600">
                Escanea su QR de mostrador para desbloquear la estampilla.
              </span>
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setSelectedVendor(null);
                  router.push("/directorio");
                }}
                className="flex-1 h-12 rounded-2xl font-bold gap-2 text-white"
                style={{ backgroundColor: "#D3B673" }}
              >
                <ChevronRight className="w-4 h-4" />
                Ver en el directorio
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedVendor(null)}
                className="h-12 w-12 rounded-2xl border-slate-200 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
