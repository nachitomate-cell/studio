"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, limit, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Bell, ArrowLeft, ExternalLink, Calendar, Tag, MapPin } from "lucide-react";

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  tipo: string;
  leida: boolean;
  cta?: string;
  broadcastId?: string;
  ubicacion?: string;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BROADCAST_INFO:     { label: "Información", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  BROADCAST_URGENTE:  { label: "Urgente",     color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  BROADCAST_PROMO:    { label: "Promoción",   color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  BROADCAST_SORTEO:   { label: "Sorteo",      color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

function NotificacionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const broadcastId = searchParams.get("id");

  const [notif, setNotif] = useState<Notificacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!broadcastId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(`/?redirect=/notificacion%3Fid%3D${broadcastId}`);
        return;
      }

      try {
        const q = query(
          collection(db, "usuarios", user.uid, "notificaciones"),
          where("broadcastId", "==", broadcastId),
          limit(1)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data() as Omit<Notificacion, "id">;
        setNotif({ id: docSnap.id, ...data });

        if (!data.leida) {
          await updateDoc(docSnap.ref, { leida: true });
        }
      } catch (err) {
        console.error("[notificacion] error:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [broadcastId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f172a" }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (notFound || !notif) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "#0f172a" }}>
        <Bell size={48} className="text-white/20" />
        <p className="text-white/60 text-sm">Notificación no encontrada o ya no está disponible.</p>
        <button
          onClick={() => router.replace("/")}
          className="mt-2 text-sm font-medium px-4 py-2 rounded-lg"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const tipoConfig = TIPO_CONFIG[notif.tipo] ?? { label: notif.tipo, color: "#94a3b8", bg: "rgba(148,163,184,0.12)" };
  const titleClean = notif.titulo.replace(/^[^\w\s]+\s*/, "").trim();
  const dateObj = new Date(notif.fecha);
  const dateStr = dateObj.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = dateObj.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const hasCta = notif.cta && notif.cta !== "/" && notif.cta !== "";
  const mapsUrl = notif.ubicacion
    ? `https://maps.google.com/?q=${encodeURIComponent(notif.ubicacion)}`
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f172a", color: "#f1f5f9" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: "rgba(15,23,42,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <ArrowLeft size={18} className="text-white/70" />
        </button>
        <span className="text-sm font-semibold text-white/80">Notificación</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-4 px-4 py-5 max-w-xl mx-auto w-full">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: tipoConfig.bg, color: tipoConfig.color }}
          >
            {tipoConfig.label}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold leading-snug" style={{ color: "#f1f5f9" }}>
          {notif.titulo}
        </h1>

        {/* Message card */}
        <div
          className="rounded-2xl p-4 text-sm leading-relaxed"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" }}
        >
          {notif.mensaje}
        </div>

        {/* Metadata */}
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Calendar size={13} />
            <span>{dateStr} · {timeStr}</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Tag size={13} />
            <span>Club Patio Curauma</span>
          </div>
        </div>

        {/* CTA */}
        {hasCta && (
          <a
            href={notif.cta}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
            style={{ background: "rgba(78,173,31,0.15)", color: "#4ead1f", border: "1px solid rgba(78,173,31,0.3)" }}
          >
            <ExternalLink size={15} />
            Ver más
          </a>
        )}

        {/* Ubicación → Google Maps */}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
            style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}
          >
            <MapPin size={15} />
            Cómo llegar
          </a>
        )}
      </div>
    </div>
  );
}

export default function NotificacionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f172a" }}>
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      }
    >
      <NotificacionContent />
    </Suspense>
  );
}
