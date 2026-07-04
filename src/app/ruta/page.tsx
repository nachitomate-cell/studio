"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Map, Loader2, X, ChevronRight, HelpCircle, Share2 } from "lucide-react";
import { isVendorVisible, getSafeImageUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Real-time hook ────────────────────────────────────────────────────────────
function useLocalesVisitados(userId: string | null): {
  sellosLocales: Record<string, number>;
  hasSynapTechStamp: boolean;
  hasSynapTechShared: boolean;
} {
  const [sellosLocales, setSellosLocales] = useState<Record<string, number>>({});
  const [hasSynapTechStamp, setHasSynapTechStamp] = useState(false);
  const [hasSynapTechShared, setHasSynapTechShared] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "usuarios", userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSellosLocales(data.sellosLocales || {});
        setHasSynapTechStamp(!!data.hasSynapTechStamp);
        setHasSynapTechShared(!!data.hasSynapTechShared);
      }
    });
    return () => unsub();
  }, [userId]);

  return { sellosLocales, hasSynapTechStamp, hasSynapTechShared };
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
        <span className="text-xs font-black" style={{ color: "#E6196E" }}>
          {visited} / {total}
        </span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #E6196E 0%, #D3B673 100%)",
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
  isNew,
  onTapInactive,
}: {
  vendor: any;
  stampCount: number;
  isNew?: boolean;
  onTapInactive: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
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
        className={`w-full aspect-square rounded-2xl border-2 relative overflow-hidden transition-all duration-500 ${
          isInactive
            ? "border-dashed border-slate-200 bg-slate-50 cursor-pointer active:bg-slate-100"
            : isFrequent
            ? "border-[#D3B673] bg-white"
            : "border-[#E6196E] bg-white shadow-sm"
        }`}
        style={
          isFrequent
            ? { boxShadow: "0 0 20px 4px rgba(211,182,115,0.30), 0 2px 8px rgba(0,0,0,0.08)" }
            : isActive
            ? { boxShadow: "0 0 14px 2px rgba(230,25,110,0.22), 0 2px 8px rgba(0,0,0,0.06)" }
            : {}
        }
      >
        {/* Image inset — 6px inset replicates old p-1.5 */}
        <div className="absolute inset-1.5 rounded-xl overflow-hidden">
          {!imgLoaded && (
            <div className="absolute inset-0 bg-slate-200 animate-pulse z-[1]" />
          )}
          <Image
            src={getSafeImageUrl(vendor.imageUrl)}
            alt={vendor.name}
            fill
            loading="lazy"
            quality={75}
            sizes="(max-width: 640px) 33vw, 150px"
            className={`object-cover z-[2] transition-all duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            style={{
              filter: isInactive
                ? "grayscale(100%) opacity(0.4)"
                : isFrequent
                ? "drop-shadow(0 2px 8px rgba(211,182,115,0.45))"
                : "none",
              transform: isInactive ? "scale(0.95)" : "scale(1)",
            }}
          />
        </div>

        {/* Inset shadow overlay */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_8px_rgba(0,0,0,0.05)]" />

        {/* Stamp count badge */}
        {!isInactive && (
          <div
            className="absolute -bottom-2 -right-2 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md"
            style={{ backgroundColor: isFrequent ? "#D3B673" : "#E6196E" }}
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

        {/* Nuevo badge */}
        {isNew && !isFrequent && (
          <div
            className="absolute top-1.5 left-1.5 px-1.5 rounded-md font-black uppercase tracking-wide text-white"
            style={{ fontSize: 8, lineHeight: "16px", backgroundColor: "#22c55e" }}
          >
            Nuevo
          </div>
        )}
      </div>

      {/* Label */}
      <p
        className="text-[10px] text-center font-bold leading-tight line-clamp-2 transition-colors duration-300"
        style={{
          color: isFrequent ? "#C9920A" : isActive ? "#E6196E" : "#94a3b8",
        }}
      >
        {vendor.name}
      </p>
    </div>
  );
}

// ── SynapTech special stamp ───────────────────────────────────────────────────
function SynapTechStampCell({
  collected,
  shared,
  onTap,
}: {
  collected: boolean;
  shared: boolean;
  onTap: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2" onClick={onTap}>
      <div
        className="w-full aspect-square rounded-2xl border-2 relative overflow-hidden transition-all duration-500 cursor-pointer active:scale-95"
        style={
          collected
            ? {
                borderColor: "#7C3AED",
                background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
                boxShadow: "0 0 22px 5px rgba(124,58,237,0.18), 0 2px 8px rgba(0,0,0,0.07)",
              }
            : {
                borderStyle: "dashed",
                borderColor: "#e2e8f0",
                background: "#f8fafc",
              }
        }
      >
        {/* Centered icon — inset-3 replicates old p-3 */}
        <div className="absolute inset-3 overflow-hidden">
          <Image
            src="/empresa.png"
            alt="SynapTech SpA"
            fill
            loading="lazy"
            quality={75}
            sizes="(max-width: 640px) 33vw, 150px"
            className="object-contain transition-all duration-500"
            style={{
              filter: collected
                ? "drop-shadow(0 4px 12px rgba(124,58,237,0.35))"
                : "grayscale(100%) opacity(0.35)",
              transform: collected ? "scale(1)" : "scale(0.92)",
            }}
          />
        </div>

        {/* "ST" badge */}
        {collected && (
          <div
            className="absolute -bottom-2 -right-2 text-white text-[9px] font-black px-1.5 h-5 rounded-full flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            ST
          </div>
        )}

        {/* Share badge */}
        {collected && !shared && (
          <div
            className="absolute -top-2 -right-2 text-white text-[8px] font-black px-1.5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse"
            style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}
          >
            +1
          </div>
        )}
        {collected && shared && (
          <div
            className="absolute -top-2 -right-2 text-white text-[7px] font-black px-1.5 h-5 rounded-full flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}
          >
            ✓
          </div>
        )}

        {/* Special sparkle corner */}
        {collected && (
          <div
            className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            <span style={{ fontSize: 8, lineHeight: 1 }}>✨</span>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_8px_rgba(0,0,0,0.04)]" />
      </div>

      <p
        className="text-[10px] text-center font-bold leading-tight transition-colors duration-300"
        style={{ color: collected ? "#7C3AED" : "#94a3b8" }}
      >
        SynapTech SpA
      </p>
    </div>
  );
}

// ── Logo rain ─────────────────────────────────────────────────────────────────
function LogoRain({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  const items = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${(i * 4.7 + 2) % 94}%`,
    delay: `${(i * 0.15) % 1.6}s`,
    duration: `${1.4 + (i * 0.11) % 1.2}s`,
    size: 60 + (i * 12) % 60,
  }));

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes logoRainFall {
          0%   { transform: translateY(-80px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {items.map((item) => (
        <img
          key={item.id}
          src="/emp.png"
          alt=""
          style={{
            position: "absolute",
            left: item.left,
            top: 0,
            width: item.size,
            height: item.size,
            objectFit: "contain",
            animation: `logoRainFall ${item.duration} ${item.delay} ease-in forwards`,
          }}
        />
      ))}
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
  const [showSynapModal, setShowSynapModal] = useState<"invite" | "thanks" | null>(null);
  const [showLogoRain, setShowLogoRain] = useState(false);

  // Real-time stamp data — auto-updates when any sale is confirmed
  const { sellosLocales, hasSynapTechStamp, hasSynapTechShared } = useLocalesVisitados(userId);
  const { toast } = useToast();

  const handleVisitSynapTech = () => {
    window.open("https://synaptechspa.cl", "_blank", "noopener,noreferrer");
    setShowSynapModal(null);
    setShowLogoRain(true);
    if (userId) {
      updateDoc(doc(db, "usuarios", userId), { hasSynapTechStamp: true }).catch(() => {});
    }
  };

  const handleShareSynapTech = async () => {
    if (!userId || hasSynapTechShared) return;
    try {
      await navigator.share({
        title: "Club Patio Curauma",
        text: "Descubrí esta app hecha por @SynapTechSpA 🚀 synaptechspa.cl",
        url: "https://synaptechspa.cl",
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ title: "No se pudo compartir", variant: "destructive" });
      }
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión activa.");
      const res = await fetch("/api/synaptech/share-bonus", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo acreditar el sello.");
      toast({ title: "¡+1 Sello ganado!", description: "Gracias por compartir SynapTech 🚀" });
      setShowSynapModal(null);
      setShowLogoRain(true);
    } catch (err: any) {
      toast({
        title: "No se pudo acreditar el sello",
        description: err?.message ?? "Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

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

  // Unique categories (sorted, non-null) — "portal" excluded from filters
  const categories = useMemo(() => {
    const cats = new Set(
      entrepreneurs.map((v) => v.category).filter((c): c is string => !!c && c !== "portal")
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

  // Count per category for chip labels
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of entrepreneurs) {
      if (v.category && v.category !== "portal") counts[v.category] = (counts[v.category] || 0) + 1;
    }
    return counts;
  }, [entrepreneurs]);

  // Visited count (real-time derived) — SynapTech counts as +1 special stamp
  const visitedCount = useMemo(
    () => entrepreneurs.filter((v) => (sellosLocales[v.id] || 0) > 0).length + (hasSynapTechStamp ? 1 : 0),
    [entrepreneurs, sellosLocales, hasSynapTechStamp]
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
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-[#E6196E]/25 shadow-sm">
          <Image
            src="/curauma/logo-ruta-curauma.png"
            alt="Logo Ruta Curauma"
            width={36}
            height={36}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-slate-800">Ruta Curauma</h1>
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
            <div className="w-11 h-11 rounded-2xl overflow-hidden shrink-0 border border-[#E6196E]/25 shadow-sm">
              <Image
                src="/curauma/logo-ruta-curauma.png"
                alt="Logo Ruta Curauma"
                width={44}
                height={44}
                className="object-cover w-full h-full"
              />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">Ruta Curauma</h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Visita cada local para iluminar su estampilla
              </p>
            </div>
          </div>
          <ProgressBar visited={visitedCount} total={entrepreneurs.length + 1} />
        </div>

        {/* Próximos premios por descubrimiento */}
        <div
          className="rounded-2xl p-4 flex gap-3 items-start"
          style={{
            background: "linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)",
            border: "1px solid #fde68a",
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>🏆</span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "#92400e" }}>
              Próximamente
            </p>
            <p className="text-sm font-bold text-amber-900 leading-snug mt-0.5">
              ¡Premios por descubrir locales!
            </p>
            <p className="text-[12px] text-amber-800 leading-relaxed mt-1">
              Pronto, completar cierta cantidad de estampillas del álbum te dará acceso a recompensas exclusivas. ¡Empieza a recorrer el Patio!
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-200" />
            Sin visitar
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#E6196E" }} />
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
              Todos · {entrepreneurs.length}
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
                  {cat} · {categoryCounts[cat] ?? 0}
                </button>
              );
            })}
          </div>
        )}

        {/* Stamp grid */}
        <div className="grid grid-cols-3 gap-4">
          {filteredVendors.length > 0 ? (
            filteredVendors.map((vendor) => {
              const createdAt = vendor.createdAt?.toDate?.() ?? (vendor.createdAt ? new Date(vendor.createdAt) : null);
              const isNew = createdAt ? (Date.now() - createdAt.getTime()) < 14 * 24 * 60 * 60 * 1000 : false;
              return (
                <StampCell
                  key={vendor.id}
                  vendor={vendor}
                  stampCount={sellosLocales[vendor.id] || 0}
                  isNew={isNew}
                  onTapInactive={() => setSelectedVendor(vendor)}
                />
              );
            })
          ) : (
            <div className="col-span-2 py-10 text-center text-sm text-slate-400 italic">
              No hay locales en esta categoría.
            </div>
          )}

          {/* SynapTech special stamp — only visible in "Todos" view */}
          {activeCategory === null && <SynapTechStampCell
            collected={hasSynapTechStamp}
            shared={hasSynapTechShared}
            onTap={() => {
              if (hasSynapTechStamp) {
                setShowLogoRain(true);
                setShowSynapModal("thanks");
              } else {
                setShowSynapModal("invite");
              }
            }}
          />}
        </div>
      </div>

      {/* Logo rain */}
      {showLogoRain && <LogoRain onDone={() => setShowLogoRain(false)} />}

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
              style={{ background: "linear-gradient(135deg, rgba(230,25,110,0.22) 0%, rgba(211,182,115,0.10) 100%)" }}
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden mb-5 border border-[#E6196E]/40 shadow-md">
                <Image
                  src="/curauma/logo-ruta-curauma.png"
                  alt="Logo Ruta Curauma"
                  width={56}
                  height={56}
                  className="object-cover w-full h-full"
                />
              </div>
              <h2 className="text-xl font-black text-white leading-snug">
                Tu Pasaporte<br />Ruta Curauma
              </h2>
            </div>

            {/* Body */}
            <div className="px-7 py-6 space-y-4">
              {/* Main explanation */}
              <div className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">⭐</span>
                <p className="text-sm text-slate-300 leading-relaxed">
                  ¡Esta es tu colección personal de aventuras! Cada vez que escaneas el QR del mostrador de un local del Patio, su estampilla se{" "}
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
                  { dot: "#E6196E", label: "Visitado", sub: "Rosa vibrante · contador de sellos" },
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
                style={{ background: "linear-gradient(135deg, #E6196E 0%, #C9920A 100%)", color: "#fff", boxShadow: "0 6px 18px rgba(230,25,110,0.35)" }}
              >
                ¡Vamos a recorrer!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SynapTech — invite modal (stamp not collected) */}
      {showSynapModal === "invite" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-5 animate-in fade-in duration-200"
          onClick={() => setShowSynapModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
            style={{ background: "#0F172A" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-7 pt-8 pb-6"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(79,70,229,0.10) 100%)" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 p-2"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "0 8px 20px rgba(124,58,237,0.4)" }}
              >
                <img src="/empresa.png" alt="SynapTech" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xl font-black text-white leading-snug">¿Te gusta esta App? 🚀</h2>
            </div>

            {/* Body */}
            <div className="px-7 py-6">
              <p className="text-sm leading-relaxed" style={{ color: "rgba(203,213,225,0.9)" }}>
                Esta plataforma fue diseñada y desarrollada por{" "}
                <span className="font-bold text-violet-400">SynapTech SpA</span>. Ayudamos a emprendedores a digitalizar sus negocios con tecnología de punta.{" "}
                ¡Visita nuestra web para conocer más y obtén esta estampilla especial de regalo!
              </p>
            </div>

            {/* Actions */}
            <div className="px-7 pb-8 flex flex-col gap-3">
              <button
                onClick={handleVisitSynapTech}
                className="w-full h-13 rounded-2xl font-black text-white text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{
                  height: 52,
                  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  boxShadow: "0 8px 24px rgba(124,58,237,0.40)",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                Visitar synaptechspa.cl ↗
              </button>
              <button
                onClick={() => setShowSynapModal(null)}
                className="w-full h-11 rounded-2xl font-bold text-sm transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SynapTech — collected thanks modal */}
      {showSynapModal === "thanks" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSynapModal(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl p-7 space-y-5 animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg p-2.5"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
              >
                <img src="/empresa.png" alt="SynapTech" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#7C3AED" }}>
                  Estampilla Especial · Coleccionada ✨
                </p>
                <h3 className="text-lg font-black text-slate-800">SynapTech SpA</h3>
              </div>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed">
              ¿Ya viste las últimas novedades? En{" "}
              <span className="font-bold" style={{ color: "#7C3AED" }}>synaptechspa.cl</span>{" "}
              encontrarás soluciones digitales para llevar tu negocio al siguiente nivel. ¡Vuelve a visitarnos!
            </p>

            {!hasSynapTechShared && (
              <div
                className="rounded-2xl p-4 space-y-2"
                style={{ background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)", border: "1px solid #86EFAC" }}
              >
                <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">
                  🎁 Sello extra disponible
                </p>
                <p className="text-sm text-emerald-800 leading-snug">
                  Comparte SynapTech con tus contactos y gana{" "}
                  <span className="font-bold">+1 sello</span> en tu tarjeta de fidelidad.
                </p>
                <button
                  onClick={handleShareSynapTech}
                  className="w-full rounded-xl font-black text-sm text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2 mt-1"
                  style={{ height: 44, background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", boxShadow: "0 4px 14px rgba(5,150,105,0.35)" }}
                >
                  <Share2 className="w-4 h-4" />
                  Compartir SynapTech · +1 Sello
                </button>
              </div>
            )}

            {hasSynapTechShared && (
              <div
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}
              >
                <span className="text-lg">✅</span>
                <p className="text-sm font-bold text-emerald-700">¡Ya compartiste! Sello extra obtenido.</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  window.open("https://synaptechspa.cl", "_blank", "noopener,noreferrer");
                  setShowSynapModal(null);
                }}
                className="w-full rounded-2xl font-black text-sm text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{ height: 52, background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}
              >
                Visitar synaptechspa.cl ↗
              </button>
              <button
                onClick={() => setShowSynapModal(null)}
                className="w-full h-11 rounded-2xl font-bold text-sm transition-colors"
                style={{ color: "rgba(100,100,120,0.5)" }}
              >
                Cerrar
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
                  router.push("/");
                }}
                className="flex-1 h-12 rounded-2xl font-bold gap-2 text-white"
                style={{ backgroundColor: "#D3B673" }}
              >
                <ChevronRight className="w-4 h-4" />
                Ver directorio
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
