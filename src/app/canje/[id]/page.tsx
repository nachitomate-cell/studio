"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckCircle2, Clock, AlertTriangle, ArrowLeft, Gift, QrCode, Loader2 } from "lucide-react";

interface CanjeData {
  userId: string;
  usuarioNombre: string;
  premioNombre: string;
  codigoVoucher: string;
  estado: "pendiente" | "canjeado" | "expirado";
  fechaEmision: string;
  fechaExpiracion: string;
}

function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return timeLeft;
}

export default function TicketCanjePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [canje, setCanje] = useState<CanjeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const timeLeft = useCountdown(canje?.fechaExpiracion ?? null);

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "canjes_activos", id);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setNotFound(true);
      } else {
        setCanje(snap.data() as CanjeData);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  /* ── Not Found ────────────────────────────────────────────────────── */
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 to-slate-100 p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-slate-300" />
        <p className="text-lg font-bold text-slate-400">Ticket no encontrado</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm font-bold underline"
          style={{ color: "#9DCC65" }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const isExpired =
    canje!.estado === "expirado" ||
    new Date(canje!.fechaExpiracion) < new Date();
  const isUsed = canje!.estado === "canjeado";
  const isActive = !isExpired && !isUsed;

  /* ── Ticket Activo ────────────────────────────────────────────────── */
  if (isActive) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-5"
        style={{
          background: "linear-gradient(135deg, #f0f7e8 0%, #e8f4f8 100%)",
        }}
      >
        <div className="w-full max-w-sm">
          {/* Volver */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm font-bold mb-6 transition-opacity hover:opacity-70"
            style={{ color: "#4A4A4A" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Inicio
          </button>

          {/* Tarjeta glassmorphism */}
          <div
            className="w-full rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(255,255,255,0.88)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(157,204,101,0.3)",
            }}
          >
            {/* Franja de color superior */}
            <div
              className="h-2 w-full"
              style={{
                background: "linear-gradient(90deg, #9DCC65 0%, #6EBBD1 100%)",
              }}
            />

            <div className="p-7 space-y-6">
              {/* Badge "Ticket Activo" */}
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: "#9DCC65" }}
                />
                <span
                  className="text-[10px] font-black uppercase tracking-[0.15em]"
                  style={{ color: "#9DCC65" }}
                >
                  Ticket Activo
                </span>
              </div>

              {/* Icono + nombre del premio */}
              <div className="text-center space-y-3">
                <div
                  className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #9DCC65, #6EBBD1)",
                  }}
                >
                  <Gift className="w-10 h-10 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                    Tu Premio
                  </p>
                  <h1
                    className="text-2xl font-black leading-tight"
                    style={{ color: "#4A4A4A" }}
                  >
                    {canje!.premioNombre}
                  </h1>
                </div>
              </div>

              {/* Código del voucher */}
              <div className="bg-slate-50 rounded-2xl py-4 px-5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Código de Voucher
                </p>
                <p
                  className="text-2xl font-black tracking-[0.18em]"
                  style={{ color: "#D3B673" }}
                >
                  {canje!.codigoVoucher}
                </p>
              </div>

              {/* Contador regresivo */}
              <div
                className="flex items-center justify-center gap-3 py-4 rounded-2xl"
                style={{
                  background: "rgba(157,204,101,0.07)",
                  border: "1px solid rgba(157,204,101,0.2)",
                }}
              >
                <Clock className="w-4 h-4 shrink-0" style={{ color: "#9DCC65" }} />
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Tiempo restante
                  </p>
                  <p
                    className="text-2xl font-black tabular-nums mt-0.5"
                    style={{ color: "#4A4A4A" }}
                  >
                    {timeLeft}
                  </p>
                  <p className="text-[10px] text-slate-300 mt-0.5">
                    Válido por 48 horas desde la emisión
                  </p>
                </div>
              </div>

              {/* Placeholder validación QR */}
              <div
                className="rounded-2xl p-5 text-center space-y-2"
                style={{
                  background: "rgba(110,187,209,0.07)",
                  border: "2px dashed rgba(110,187,209,0.35)",
                }}
              >
                <QrCode className="w-8 h-8 mx-auto" style={{ color: "#6EBBD1" }} />
                <p
                  className="text-xs font-black uppercase tracking-widest"
                  style={{ color: "#6EBBD1" }}
                >
                  Validación en Caja
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Próximamente QR
                </p>
                <p className="text-[10px] text-slate-300">En fase de producción</p>
              </div>

              {/* Pie del ticket */}
              <div className="flex justify-between text-[10px] text-slate-300 font-medium pt-1">
                <span>{canje!.usuarioNombre}</span>
                <span>
                  {new Date(canje!.fechaEmision).toLocaleDateString("es-CL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Ticket Expirado ──────────────────────────────────────────────── */
  if (isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6 text-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <Clock className="w-10 h-10 text-slate-300" />
          </div>
          <div>
            <h2
              className="text-xl font-black"
              style={{ color: "#4A4A4A" }}
            >
              Este ticket ha expirado
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              El voucher para &quot;{canje!.premioNombre}&quot; ya no es válido.
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="w-full h-12 rounded-2xl font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#9DCC65" }}
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  /* ── Ticket Canjeado ──────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{
        background: "linear-gradient(135deg, #f0f7e8 0%, #e8f4f8 100%)",
      }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: "#9DCC65" }}
        >
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-black" style={{ color: "#4A4A4A" }}>
            ¡Beneficio Utilizado!
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            Este voucher de &quot;{canje!.premioNombre}&quot; ya fue canjeado con éxito.
          </p>
        </div>

        {/* Banner publicitario */}
        <a
          href="https://www.patiocuraumaonline.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-2xl p-5 text-left transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #9DCC65 0%, #6EBBD1 100%)",
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1">
            Descubre más
          </p>
          <p className="text-sm font-black text-white leading-snug">
            ¿Te gustó tu premio? Encuentra más productos increíbles de nuestros emprendedores aquí
          </p>
          <p className="text-[11px] font-bold text-white/70 mt-2 underline underline-offset-2">
            patiocuraumaonline.com →
          </p>
        </a>

        <button
          onClick={() => router.push("/")}
          className="w-full h-12 rounded-2xl font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#9DCC65" }}
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}
