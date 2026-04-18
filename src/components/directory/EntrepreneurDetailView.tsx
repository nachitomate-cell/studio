
"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import Image from "next/image";
import { cn, getSafeImageUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Paleta de colores por método de pago
const PAYMENT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  efectivo:      { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  debito:        { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  transferencia: { bg: "#FAF5FF", text: "#6B21A8", border: "#E9D5FF" },
  _default:      { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
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
            imagenUrl: data.imageUrls?.[0] || data.imagenUrl || "/Logo3.png",
            imagenPerfil: data.imagenPerfil || data.imageUrls?.[0] || data.imagenUrl || "/Logo3.png",
            logoHeader:   data.logoHeader   || data.imageUrls?.[0] || data.imagenUrl || "/Logo3.png",
            whatsapp:  data.whatsapp || data.contactPhone || "",
            instagram: data.instagram || "",
            ubicacion: data.address || data.ubicacionTienda || "",
            horario:   data.operatingHours || data.horario || "",
            mediosPago: data.mediosPago || [],
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

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: entrepreneur?.nombre,
        text: "¡Mira este emprendimiento en Club Patio Curauma!",
        url: window.location.href,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F2F4F0]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-primary/60 font-bold uppercase text-[10px] tracking-widest">
          Cargando experiencia...
        </p>
      </div>
    );
  }

  if (!entrepreneur) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[#F2F4F0]">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
          <MapPin className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">Local no encontrado</h1>
        <Button onClick={() => router.push("/")} className="rounded-xl bg-primary">
          Volver a Descubre
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F4F0] pb-24 font-body animate-in fade-in duration-500">

      {/* ── Botones flotantes ───────────────────────────────────────────── */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => router.push("/")}
          className="rounded-full shadow-xl bg-white/90 backdrop-blur-md border-none"
        >
          <ArrowLeft className="w-5 h-5 text-primary" />
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsFavorite(!isFavorite)}
            className="rounded-full shadow-xl bg-white/90 backdrop-blur-md border-none"
          >
            <Heart
              className={cn(
                "w-5 h-5 transition-colors",
                isFavorite ? "fill-red-500 text-red-500" : "text-slate-400"
              )}
            />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleShare}
            className="rounded-full shadow-xl bg-white/90 backdrop-blur-md border-none"
          >
            <Share2 className="w-5 h-5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* ── HERO con gradiente + nombre sobre imagen ────────────────────── */}
      <div className="relative h-[48vh] w-full bg-slate-200">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-300 animate-pulse z-0" />
        )}
        <Image
          src={getSafeImageUrl(entrepreneur.imagenPerfil)}
          alt={entrepreneur.nombre}
          fill
          className={cn(
            "object-cover z-10 transition-opacity duration-700",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setImageLoaded(true)}
          priority
        />
        {/* Gradiente: de transparente arriba → negro 60% abajo */}
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.60) 100%)",
          }}
        />
        {/* Nombre y badge sobre la imagen */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-6 space-y-1.5">
          <h1
            className="text-white leading-tight tracking-tight"
            style={{ fontSize: "22px", fontWeight: 700 }}
          >
            {entrepreneur.nombre}
          </h1>
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
        </div>
      </div>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto px-5 -mt-4 relative z-10 space-y-4">

        {/* Card principal de información */}
        <Card
          className="border-none bg-white overflow-hidden"
          style={{
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}
        >
          <CardContent className="p-6 space-y-5">
            {/* Logo + descripción */}
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 overflow-hidden shrink-0 bg-slate-50"
                style={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <img
                  src={getSafeImageUrl(entrepreneur.logoHeader, "/Logo3.png")}
                  alt={`Logo ${entrepreneur.nombre}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/Logo3.png";
                  }}
                />
              </div>
              <p
                className="leading-relaxed flex-1 pt-0.5"
                style={{ fontSize: "14px", color: "#64748B" }}
              >
                {entrepreneur.descripcion}
              </p>
            </div>

            <Separator className="bg-slate-100" />

            {/* Ubicación + Horario */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    Sector
                  </p>
                  <p className="text-xs font-bold text-slate-700 leading-tight truncate">
                    {entrepreneur.ubicacion || "Consultar en local"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    Horario
                  </p>
                  <p className="text-xs font-bold text-slate-700 leading-tight truncate">
                    {entrepreneur.horario || "Consultar en local"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Métodos de pago ──────────────────────────────────────────── */}
        <section className="space-y-2.5 px-1">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Aceptamos
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
                const style = isActive
                  ? (PAYMENT_STYLES[pay.key] ?? PAYMENT_STYLES._default)
                  : { bg: "#F1F5F9", text: "#94A3B8", border: "#E2E8F0" };
                const { Icon } = pay;

                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none transition-opacity"
                    style={{
                      background: style.bg,
                      color: style.text,
                      border: `1px solid ${style.border}`,
                      borderRadius: "20px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      opacity: hasConfig && !medios.includes(pay.key) ? 0.45 : 1,
                    }}
                    onClick={() => {
                      if (!hasConfig) {
                        toast({
                          description:
                            "Consulta los medios de pago directamente en el local",
                        });
                      }
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {pay.label}
                  </div>
                );
              });
            })()}
          </div>
        </section>

        {/* ── Botones de acción + Banner (agrupados para gap ajustado) ── */}
        <div className="space-y-2">
        <div className="space-y-3">
          {/* WhatsApp */}
          <Button
            className="w-full h-14 rounded-2xl font-black text-base gap-3 transition-all active:scale-95"
            style={
              entrepreneur.whatsapp
                ? {
                    backgroundColor: "#25D366",
                    color: "white",
                    boxShadow: "0 8px 20px rgba(37,211,102,0.22)",
                  }
                : {
                    backgroundColor: "#E2E8F0",
                    color: "#94A3B8",
                    cursor: "default",
                  }
            }
            onClick={() => {
              if (entrepreneur.whatsapp) {
                window.open(
                  `https://wa.me/${entrepreneur.whatsapp.replace(/\D/g, "")}`,
                  "_blank"
                );
              } else {
                toast({
                  description:
                    "Este emprendedor aún no ha agregado su WhatsApp. ¡Visítalos en el patio!",
                });
              }
            }}
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            {entrepreneur.whatsapp ? "Contactar por WhatsApp" : "WhatsApp no disponible"}
          </Button>

          {/* Instagram + Ver Mapa — misma altura que WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-14 rounded-2xl font-bold gap-2 transition-all active:scale-95 bg-white"
              style={
                entrepreneur.instagram
                  ? {
                      border: "1.5px solid #C9920A",
                      color: "#C9920A",
                      boxShadow: "none",
                    }
                  : {
                      border: "1.5px solid #E2E8F0",
                      color: "#94A3B8",
                      opacity: 0.7,
                    }
              }
              onClick={() => {
                if (entrepreneur.instagram) {
                  window.open(
                    `https://instagram.com/${entrepreneur.instagram.replace("@", "")}`,
                    "_blank"
                  );
                } else {
                  toast({
                    description:
                      "Aún no hay Instagram registrado. ¡Encuéntralos en Patio Curauma!",
                  });
                }
              }}
            >
              <Instagram className="w-5 h-5" />
              {entrepreneur.instagram ? "Instagram" : "Sin Instagram"}
            </Button>

            <Button
              className="h-14 rounded-2xl font-bold gap-2 transition-all active:scale-95 bg-white"
              style={
                entrepreneur.ubicacion
                  ? {
                      border: "1.5px solid #C9920A",
                      color: "#C9920A",
                      boxShadow: "none",
                    }
                  : {
                      border: "1.5px solid #E2E8F0",
                      color: "#94A3B8",
                      opacity: 0.7,
                    }
              }
              onClick={() => {
                if (entrepreneur.ubicacion) {
                  window.open(
                    "https://maps.google.com/?q=-33.1316449,-71.564289",
                    "_blank"
                  );
                } else {
                  toast({
                    description: "Pregunta por este local en la entrada del patio",
                  });
                }
              }}
            >
              <MapPin className="w-5 h-5" />
              {entrepreneur.ubicacion ? "Ver Mapa" : "Sin Ubicación"}
            </Button>
          </div>
        </div>

        {/* ── Banner de recompensas ────────────────────────────────────── */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{ boxShadow: "0 4px 16px rgba(184,134,11,0.20)" }}
        >
          <div
            className="p-5 flex items-center gap-4"
            style={{ backgroundColor: "#B8860B" }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <Gift className="w-[22px] h-[22px] text-amber-100" />
            </div>
            <div className="flex-1">
              <p
                className="uppercase tracking-widest font-black"
                style={{ fontSize: "10px", color: "rgba(255,240,180,0.85)" }}
              >
                Gana Recompensas
              </p>
              <p
                className="font-bold leading-snug mt-0.5"
                style={{ fontSize: "13px", color: "#FFF8E1" }}
              >
                Muestra tu QR al pagar en este local para sumar sellos.
              </p>
            </div>
          </div>
        </div>
        </div>{/* end space-y-2 */}

        <footer className="text-center pt-2 pb-8">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
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
