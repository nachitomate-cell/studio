
"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot, query, collection, documentId, where, getDocs, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { AssociatedShopsCarousel } from "./AssociatedShopsCarousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  MessageCircle,
  Instagram,
  MapPin,
  Clock,
  CreditCard,
  Wallet,
  Banknote,
  Loader2,
  Share2,
  Heart,
  Gift,
} from "lucide-react";
import { cn, getSafeImageUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getOpenStatus } from "@/lib/horarios";
import { useUserLocation, haversineKm, formatDistance } from "@/hooks/useUserLocation";
import { PATIO_INFO } from "@/lib/data";

// Estilo unificado para todas las pills de medios de pago — contorno sutil, texto blanco
const PAYMENT_PILL_STYLE = {
  bg: "transparent",
  text: "#f1f5f9",
  border: "rgba(255, 255, 255, 0.20)",
};

function DetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const id = params?.id || searchParams.get("id");

  const [entrepreneur, setEntrepreneur] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [sectorExpanded, setSectorExpanded] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [scrollY, setScrollY] = useState(0);

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [associatedShopsData, setAssociatedShopsData] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);

  const { coords, loading: locLoading, request: requestLocation } = useUserLocation();

  // Auth listener + favorites persistence
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && id) {
        const userRef = doc(db, "usuarios", user.uid);
        const unsubSnap = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const favoritos: string[] = Array.isArray(data.favoritos) ? data.favoritos : [];
            setIsFavorite(favoritos.includes(id as string));
          }
        });
        return () => unsubSnap();
      }
    });
    return () => unsub();
  }, [id]);

  // Oscurecer el header global para integrar con el tema oscuro de esta vista
  useEffect(() => {
    const header = document.querySelector("header") as HTMLElement | null;
    if (!header) return;
    const prevBg    = header.style.background;
    const prevBorder = header.style.borderBottomColor;
    const prevShadow = header.style.boxShadow;
    header.style.background        = "rgba(15, 23, 42, 0.95)";
    header.style.borderBottomColor = "rgba(255, 255, 255, 0.07)";
    header.style.boxShadow         = "none";
    const subtitle = header.querySelector("span") as HTMLElement | null;
    const prevSubColor = subtitle?.style.color ?? "";
    if (subtitle) subtitle.style.color = "rgba(255,255,255,0.45)";
    return () => {
      header.style.background        = prevBg;
      header.style.borderBottomColor = prevBorder;
      header.style.boxShadow         = prevShadow;
      if (subtitle) subtitle.style.color = prevSubColor;
    };
  }, []);

  // Parallax scroll listener
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (entrepreneur?.associatedShops?.length > 0) {
      setLoadingShops(true);
      const fetchShops = async () => {
        try {
          // Firestore 'in' solo soporta hasta 30 elementos
          const q = query(
            collection(db, "entrepreneur_profiles"),
            where(documentId(), "in", entrepreneur.associatedShops.slice(0, 30))
          );
          const snap = await getDocs(q);
          const shops = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAssociatedShopsData(shops);
        } catch (error) {
          console.error("Error fetching associated shops:", error);
        } finally {
          setLoadingShops(false);
        }
      };
      fetchShops();
    }
  }, [entrepreneur?.associatedShops]);

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, "entrepreneur_profiles", id as string);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEntrepreneur({
            id: docSnap.id,
            nombre: data.businessName || data.nombre || "Local del Patio",
            descripcion: data.description || data.descripcion || "Sin descripción disponible.",
            rubro: data.category || data.rubro || "General",
            imagenUrl: data.imageUrls?.[0] || data.imagenUrl || "/Logo2.png",
            imagenPerfil: data.imagenPerfil || data.imageUrls?.[0] || data.imagenUrl || "/Logo2.png",
            logoHeader:   data.logoHeader   || data.imageUrls?.[0] || data.imagenUrl || "/Logo2.png",
            whatsapp:  data.whatsapp || data.contactPhone || "",
            instagram: data.instagram || "",
            ubicacion: data.address || data.ubicacionTienda || "",
            horario:   data.operatingHours || data.horario || "",
            mediosPago: data.mediosPago || [],
            horariosEstructurados: data.horariosEstructurados || null,
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            imageUrls: data.imageUrls || [],
            ...data,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error cargando detalle:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const handleFavoriteToggle = async () => {
    if (!currentUser) {
      toast({ description: "Inicia sesión para guardar favoritos" });
      return;
    }
    const newFav = !isFavorite;
    setIsFavorite(newFav);
    toast({ description: newFav ? "Guardado en favoritos" : "Eliminado de favoritos" });
    try {
      const userRef = doc(db, "usuarios", currentUser.uid);
      await updateDoc(userRef, {
        favoritos: newFav ? arrayUnion(id as string) : arrayRemove(id as string),
      });
    } catch (err) {
      console.error("Error updating favorites:", err);
    }
  };

  const handleShare = async () => {
    const shareUrl = `https://clubpatiocurauma.synaptechspa.cl/emprendedor/${id}`;
    const nombre = entrepreneur?.nombre ?? "este emprendimiento";
    const rubro = entrepreneur?.rubro ? ` · ${entrepreneur.rubro}` : "";
    const shareData = {
      title: `${nombre} — Club Patio Curauma`,
      text: `¡Te recomiendo visitar ${nombre}${rubro} en Patio Curauma! 🛍️ Encuéntralo en la app del Club:`,
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Ignorar si el usuario canceló
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ description: "Enlace copiado al portapapeles" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0f172a]">
        <Loader2 className="w-10 h-10 text-[#D3B673] animate-spin" />
        <p className="text-[#D3B673]/60 font-bold uppercase text-[10px] tracking-widest">
          Cargando experiencia...
        </p>
      </div>
    );
  }

  if (!entrepreneur) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[#0f172a]">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-slate-700">
          <MapPin className="w-10 h-10 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-200">Local no encontrado</h1>
        <Button onClick={() => router.push("/")} className="rounded-xl bg-[#D3B673] text-slate-900 hover:bg-[#BFA05C]">
          Volver a Descubre
        </Button>
      </div>
    );
  }

  const esPremium = entrepreneur.isPremium === true;
  const openStatus = getOpenStatus(entrepreneur.horariosEstructurados);
  const distanceKm = coords
    ? haversineKm(
        coords.lat,
        coords.lng,
        entrepreneur.lat ?? PATIO_INFO.coordinates.lat,
        entrepreneur.lng ?? PATIO_INFO.coordinates.lng
      )
    : null;

  // Build action buttons array
  const hasWhatsApp = !!entrepreneur.whatsapp;
  const hasInstagram = !!entrepreneur.instagram;
  const hasUbicacion = !!entrepreneur.ubicacion;

  return (
    <main className="min-h-screen bg-[#0f172a] pb-24 font-body animate-in fade-in duration-500">

      {/* ── Botones flotantes ───────────────────────────────────────────── */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
        <button
          onClick={() => router.push("/")}
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleFavoriteToggle}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Heart className={cn("w-5 h-5 transition-colors", isFavorite ? "fill-red-500 text-red-500" : "text-slate-300")} />
          </button>
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Share2 className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      </div>

      {/* ── HERO con gradiente + nombre sobre imagen ────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ height: "300px", backgroundColor: "#1e293b" }}>
        {/* Skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-800 animate-pulse" style={{ zIndex: 0 }} />
        )}
        {/* Imagen con parallax */}
        <img
          src={getSafeImageUrl(entrepreneur.imagenPerfil)}
          alt={entrepreneur.nombre}
          style={{
            width: "100%",
            height: "300px",
            objectFit: "cover",
            display: "block",
            transform: `translateY(${scrollY * 0.25}px)`,
          }}
          className={cn("transition-opacity duration-700", imageLoaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => { (e.target as HTMLImageElement).src = "/Logo2.png"; setImageLoaded(true); }}
        />
        {/* Overlay oscuro uniforme para asegurar contraste del texto */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        {/* Degradado inferior para fundir con el fondo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.9) 85%, rgba(15, 23, 42, 1) 100%)",
          }}
        />
        {/* Nombre, badge y status */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 space-y-1.5">
          <h1
            className="text-white leading-tight tracking-tight"
            style={{ fontSize: "22px", fontWeight: 700 }}
          >
            {entrepreneur.nombre}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: "rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.90)",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {entrepreneur.rubro}
            </span>
            {openStatus.isOpen !== null && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: openStatus.color === "green" ? "rgba(34,197,94,0.2)" : openStatus.color === "red" ? "rgba(239,68,68,0.2)" : "rgba(234,179,8,0.2)",
                  color: openStatus.color === "green" ? "#4ade80" : openStatus.color === "red" ? "#f87171" : "#fbbf24",
                  border: `1px solid ${openStatus.color === "green" ? "rgba(74,222,128,0.3)" : openStatus.color === "red" ? "rgba(248,113,113,0.3)" : "rgba(251,191,36,0.3)"}`,
                }}>
                <span className={`w-1.5 h-1.5 rounded-full ${openStatus.color === "green" ? "bg-green-400" : openStatus.color === "red" ? "bg-red-400" : "bg-yellow-400"} animate-pulse`} />
                {openStatus.label}
              </span>
            )}
            {distanceKm !== null ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(211,182,115,0.15)", color: "#D3B673", border: "1px solid rgba(211,182,115,0.25)" }}>
                📍 {formatDistance(distanceKm)}
              </span>
            ) : (
              <button onClick={requestLocation} disabled={locLoading}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold opacity-70 hover:opacity-100 transition-opacity"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {locLoading ? "..." : "📍 Ver distancia"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto space-y-4" style={{ position: "relative", zIndex: 1 }}>

        {/* ── Card única de información ────────────────────────────────── */}
        <div
          style={{
            background: "rgba(30, 41, 59, 0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: "24px",
            border: "1px solid rgba(211, 182, 115, 0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            margin: "-32px 16px 0 16px",
            padding: "20px",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Fila superior: logo + descripción */}
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 overflow-hidden shrink-0 bg-slate-800"
              style={{ borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <img
                src={getSafeImageUrl(entrepreneur.logoHeader, "/Logo2.png")}
                alt={`Logo ${entrepreneur.nombre}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "/Logo2.png"; }}
              />
            </div>
            <div className="flex-1 pt-0.5 min-w-0">
              <p
                className={cn(
                  "leading-relaxed",
                  esPremium ? "font-medium text-slate-200 text-lg" : "text-sm text-slate-300",
                  !isDescExpanded && "line-clamp-3"
                )}
              >
                {entrepreneur.descripcion}
              </p>
              {entrepreneur.descripcion?.length > 120 && (
                <button
                  onClick={() => setIsDescExpanded((v) => !v)}
                  className="mt-1.5 text-[11px] font-bold tracking-wide"
                  style={{ color: "#D3B673" }}
                >
                  {isDescExpanded ? "Ver menos ↑" : "Leer más ↓"}
                </button>
              )}
            </div>
          </div>

          {/* Divisor */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)", margin: "16px 0" }} />

          {/* Fila inferior: Sector + Horario (igual altura, horario condicional) */}
          {(() => {
            const horarioTexto = entrepreneur.horario || "";
            const horarioVacio = !horarioTexto || horarioTexto.trim().toLowerCase() === "consultar";
            const showHorario = !horarioVacio || openStatus.isOpen !== null;
            return (
              <div className={cn("grid gap-4 items-stretch", showHorario ? "grid-cols-2" : "grid-cols-1")}>
                <div className="flex items-start gap-3 h-full">
                  <div className="w-10 h-10 bg-[#D3B673]/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-[#D3B673]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sector</p>
                    {(() => {
                      const texto = entrepreneur.ubicacion || "Consultar en local";
                      const esLargo = texto.length > 40;
                      return esLargo ? (
                        <button onClick={() => setSectorExpanded((v) => !v)} className="text-left w-full">
                          <p className={cn("text-xs font-bold text-slate-200 leading-tight", sectorExpanded ? "" : "line-clamp-2")}>{texto}</p>
                          <span className="text-[10px] text-[#D3B673] font-semibold mt-1 block">{sectorExpanded ? "Ver menos ↑" : "Ver más ↓"}</span>
                        </button>
                      ) : (
                        <p className="text-xs font-bold text-slate-200 leading-tight">{texto}</p>
                      );
                    })()}
                  </div>
                </div>
                {showHorario && (
                  <div className="flex items-start gap-3 h-full">
                    <div className="w-10 h-10 bg-[#D3B673]/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-[#D3B673]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Horario</p>
                      {!horarioVacio && (
                        <p className="text-xs font-bold text-slate-200 leading-tight">{horarioTexto}</p>
                      )}
                      {openStatus.isOpen !== null && (
                        <p className="text-[10px] font-bold leading-tight mt-0.5" style={{
                          color: openStatus.color === "green" ? "#4ade80" : openStatus.color === "red" ? "#f87171" : "#fbbf24"
                        }}>{openStatus.label}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Galería de imágenes ──────────────────────────────────────── */}
        {entrepreneur.imageUrls?.length > 1 && (
          <section className="px-4 space-y-2 pt-2">
            <h3 className="text-[11px] font-black text-[#D3B673] uppercase tracking-widest">Galería</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {(entrepreneur.imageUrls as string[]).map((url: string, i: number) => (
                <img key={i} src={getSafeImageUrl(url)} alt={`Foto ${i+1}`}
                  className="h-32 w-32 object-cover rounded-2xl shrink-0 border border-white/10"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/Logo2.png"; }} />
              ))}
            </div>
          </section>
        )}

        {/* ── Métodos de pago — oculto para patrocinadores ─────────────── */}
        {!esPremium && <section className="space-y-3 px-4">
          <h2 className="text-[11px] font-black text-[#D3B673] uppercase tracking-widest">
            Medios de Pago
          </h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {(() => {
              const medios: string[] = entrepreneur.mediosPago || [];
              const hasConfig = medios.length > 0;
              const standardMedios = [
                { key: "efectivo",      Icon: Banknote,    label: "Efectivo" },
                { key: "debito",        Icon: CreditCard,  label: "Débito/Crédito" },
                { key: "transferencia", Icon: Wallet,      label: "Transferencia" },
              ];
              const extraMedios = medios.filter(
                (m) => !["efectivo", "debito", "transferencia"].includes(m)
              );
              const allItems = [
                ...standardMedios,
                ...extraMedios.map((m) => ({
                  key: m,
                  Icon: CreditCard,
                  label: m.charAt(0).toUpperCase() + m.slice(1),
                })),
              ];

              return allItems.map((pay, i) => {
                const isActive = !hasConfig || medios.includes(pay.key);
                const { Icon } = pay;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 shrink-0"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                      color: isActive ? "#e2e8f0" : "#64748b",
                      borderRadius: "20px",
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    {pay.label}
                  </span>
                );
              });
            })()}
          </div>
        </section>}

        {/* ── Banner de recompensas — justo antes del CTA principal ─────── */}
        {!esPremium && (
          <div
            className="mx-4 rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 0 15px rgba(201,146,10,0.15), 0 8px 32px rgba(0,0,0,0.4)" }}
            onClick={() => router.push("/premios")}
          >
            <div
              className="p-4 flex items-center gap-4"
              style={{
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))",
                border: "1px solid rgba(201, 146, 10, 0.50)",
                borderRadius: "24px",
              }}
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,146,10,0.15)" }}>
                <Gift className="w-5 h-5 text-[#C9920A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="uppercase tracking-widest font-black" style={{ fontSize: "10px", color: "#C9920A" }}>Gana Recompensas</p>
                <p className="font-medium leading-snug mt-0.5" style={{ fontSize: "12px", color: "#cbd5e1" }}>
                  Escanea el QR del mostrador para sumar sellos.
                </p>
              </div>
              <span style={{ color: "#C9920A", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>›</span>
            </div>
          </div>
        )}

        {/* ── Botones de acción ────────────────────────────────────────────── */}
        <div className="space-y-4 px-4 pt-2">
        <div className="space-y-3">
          {/* Botón principal — "Agendar / Cotizar" para premium, WhatsApp para estándar */}
          {esPremium ? (
            <button
              style={{
                background: "linear-gradient(135deg, #D3B673, #BFA05C)",
                color: "#0f172a",
                width: "100%",
                padding: "16px",
                borderRadius: "20px",
                fontSize: "16px",
                fontWeight: 900,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(211, 182, 115, 0.25)",
              }}
              onClick={() => {
                const link = entrepreneur.buttonLink || entrepreneur.urlCotizacion || entrepreneur.whatsapp;
                if (link && link.startsWith('#')) {
                  document.querySelector(link)?.scrollIntoView({ behavior: 'smooth' });
                } else if (link) {
                  window.open(link, "_blank");
                }
              }}
            >
              {entrepreneur.buttonText || "Contactar"}
            </button>
          ) : (
            hasWhatsApp && (
              <Button
                className="w-full h-14 rounded-2xl font-black text-base gap-3 transition-all active:scale-95 border-none"
                style={{
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  color: "white",
                  boxShadow: "0 8px 24px rgba(37,211,102,0.25)",
                }}
                onClick={() => {
                  let numero = entrepreneur.whatsapp.replace(/\D/g, "");
                  if (!numero.startsWith("56")) {
                    numero = "56" + numero;
                  }
                  window.open(`https://wa.me/${numero}`, "_blank");
                }}
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                Contactar por WhatsApp
              </Button>
            )
          )}

          {/* Instagram + Ver Mapa — renderizado condicional */}
          {!esPremium && (hasInstagram || hasUbicacion) && (() => {
            const buttons = [];
            if (hasInstagram) {
              buttons.push(
                <Button
                  key="instagram"
                  className="h-14 rounded-2xl font-bold gap-2 items-center transition-all active:scale-95 border-none"
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(211, 182, 115, 0.3)",
                    color: "#D3B673",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  onClick={() => {
                    window.open(
                      `https://instagram.com/${entrepreneur.instagram.replace("@", "")}`,
                      "_blank"
                    );
                  }}
                >
                  <Instagram className="w-5 h-5" />
                  Instagram
                </Button>
              );
            }
            if (hasUbicacion) {
              buttons.push(
                <Button
                  key="mapa"
                  className="h-14 rounded-2xl font-bold gap-2 items-center transition-all active:scale-95 border-none"
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(211, 182, 115, 0.3)",
                    color: "#D3B673",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  onClick={() => {
                    window.open(
                      "https://maps.google.com/?q=-33.1316449,-71.564289",
                      "_blank"
                    );
                  }}
                >
                  <MapPin className="w-5 h-5" />
                  Ver Mapa
                </Button>
              );
            }
            return (
              <div className={cn("grid gap-3", buttons.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                {buttons}
              </div>
            );
          })()}
        </div>

        {/* ── Favorito + Compartir ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleFavoriteToggle}
            className="flex items-center justify-center gap-2 h-12 rounded-2xl font-bold text-sm transition-all active:scale-95"
            style={{
              background: isFavorite ? "rgba(239,68,68,0.15)" : "rgba(30,41,59,0.6)",
              border: `1px solid ${isFavorite ? "rgba(239,68,68,0.4)" : "rgba(211,182,115,0.3)"}`,
              color: isFavorite ? "#f87171" : "#D3B673",
            }}
          >
            <Heart className={cn("w-4 h-4", isFavorite ? "fill-red-400 text-red-400" : "")} />
            {isFavorite ? "Guardado" : "Favorito"}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 h-12 rounded-2xl font-bold text-sm transition-all active:scale-95"
            style={{
              background: "rgba(30,41,59,0.6)",
              border: "1px solid rgba(211,182,115,0.3)",
              color: "#D3B673",
            }}
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </button>
        </div>

        </div>{/* end action buttons */}

        {/* ── Comercios Asociados (Portal) ────────────────────────────── */}
        {entrepreneur.associatedShops && entrepreneur.associatedShops.length > 0 && (
          <div className="space-y-4 pt-6" id="comercios-asociados">
            <h2 className="text-lg font-black text-white px-4">Comercios Asociados</h2>
            <AssociatedShopsCarousel shops={associatedShopsData} isLoading={loadingShops} />
          </div>
        )}

        <footer className="text-center pt-8 pb-10">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
            Toda la información ha sido proporcionada
            <br />
            por el emprendedor de Patio Curauma.
          </p>
        </footer>
      </div>
    </main>
  );
}

export function EntrepreneurDetailView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <DetailContent />
    </Suspense>
  );
}
