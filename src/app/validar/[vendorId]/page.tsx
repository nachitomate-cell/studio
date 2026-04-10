"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection, onSnapshot, query, where, Timestamp,
} from "firebase/firestore";
import { confirmarHandshake, rechazarHandshake } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, CheckCircle2, XCircle, Clock, ShieldCheck,
  ChevronLeft, User, AlertTriangle, Store, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PendingStamp {
  id: string;
  userId: string;
  userName: string;
  vendorId: string;
  status: "pending" | "confirmed" | "expired" | "rejected";
  createdAt: Timestamp | null;
}

const MAX_MINUTES = 5;

function getElapsedSeconds(createdAt: Timestamp | null): number {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - createdAt.toDate().getTime()) / 1000);
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `hace ${seconds}s`;
  return `hace ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// ─── Modal de confirmación ────────────────────────────────────────────────────

function ConfirmModal({
  stamp,
  onClose,
  onConfirm,
  onReject,
  loading,
}: {
  stamp: PendingStamp;
  onClose: () => void;
  onConfirm: (monto: number) => void;
  onReject: () => void;
  loading: boolean;
}) {
  const [monto, setMonto] = useState("");
  const elapsed = getElapsedSeconds(stamp.createdAt);
  const isExpired = elapsed >= MAX_MINUTES * 60;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4" />

        <div className="px-7 pt-5 pb-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(211,182,115,0.12)", color: "#D3B673" }}
            >
              <User className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">{stamp.userName}</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Solicitud recibida {formatElapsed(elapsed)}
              </p>
            </div>
          </div>

          {/* Alerta expirado */}
          {isExpired && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-xs font-bold text-amber-700">
                Esta solicitud ya expiró. Si confirmas, se marcará como expirada.
              </p>
            </div>
          )}

          {/* Monto */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Monto de la compra (opcional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                disabled={loading}
                className="w-full h-14 pl-8 pr-4 rounded-2xl border-2 border-slate-200 focus:border-primary focus:outline-none text-lg font-black text-slate-800 bg-slate-50 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Si dejas el campo vacío, se guarda como $0.
            </p>
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => onConfirm(parseFloat(monto) || 0)}
              disabled={loading}
              className="w-full h-14 rounded-2xl font-black text-base gap-2 shadow-lg"
              style={{ backgroundColor: "#D3B673" }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Confirmar sello
                </>
              )}
            </Button>
            <Button
              onClick={onReject}
              disabled={loading}
              variant="outline"
              className="w-full h-12 rounded-2xl font-bold gap-2 text-slate-500 border-slate-200"
            >
              <XCircle className="w-4 h-4" />
              Rechazar solicitud
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de solicitud pendiente ──────────────────────────────────────────

function StampCard({
  stamp,
  onClick,
}: {
  stamp: PendingStamp;
  onClick: () => void;
}) {
  const [elapsed, setElapsed] = useState(getElapsedSeconds(stamp.createdAt));

  // FIX: usar stamp.id (string estable) como dep en vez de stamp.createdAt
  // (Timestamp — nueva referencia de objeto en cada snapshot de Firestore)
  const stampId = stamp.id;
  const createdAt = stamp.createdAt;
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(getElapsedSeconds(createdAt));
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampId]); // stampId no cambia para el mismo documento

  const remaining = Math.max(0, MAX_MINUTES * 60 - elapsed);
  const progress = (remaining / (MAX_MINUTES * 60)) * 100;
  const isUrgent = remaining < 60;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-3xl border overflow-hidden shadow-sm transition-all active:scale-[0.98] hover:shadow-md"
      style={{ borderColor: isUrgent ? "#ef444440" : "#e2e8f0" }}
    >
      {/* Barra de tiempo */}
      <div className="w-full h-1.5 bg-slate-100">
        <div
          className="h-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            backgroundColor: isUrgent ? "#ef4444" : "#D3B673",
          }}
        />
      </div>

      <div className="px-5 py-4 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isUrgent ? "rgba(239,68,68,0.1)" : "rgba(211,182,115,0.12)",
            color: isUrgent ? "#ef4444" : "#D3B673",
          }}
        >
          <User className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 truncate">{stamp.userName}</p>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            {formatElapsed(elapsed)}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p
            className="text-sm font-black tabular-nums"
            style={{ color: isUrgent ? "#ef4444" : "#D3B673" }}
          >
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">restante</p>
        </div>
      </div>
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ValidarPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [vendorName, setVendorName] = useState("Mi Local");
  const [pendingStamps, setPendingStamps] = useState<PendingStamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<PendingStamp | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // FIX: eliminado el estado `tick` — causaba que la suscripción se destruyera y
  // recreara cada 15s, haciendo que Firebase devolviera el cache vacío brevemente
  // antes de re-sincronizar con el servidor ("aparecer y desaparecer")

  // Verificar auth y permisos
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user || user.uid !== vendorId) {
        setAuthLoading(false);
        setAuthorized(false);
        return;
      }
      setAuthorized(true);

      // Cargar nombre del local
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db, "entrepreneur_profiles", vendorId));
        if (snap.exists()) {
          const d = snap.data();
          setVendorName(d.businessName || d.nombre || "Mi Local");
        } else {
          const snap2 = await getDoc(doc(db, "usuarios", vendorId));
          if (snap2.exists()) {
            const d = snap2.data();
            setVendorName(d.nombreTienda || d.nombre || "Mi Local");
          }
        }
      } catch {/* cosmético */}

      setAuthLoading(false);
    });
    return () => unsub();
  }, [vendorId]);

  // FIX: query solo por vendorId (single-field) — evita requerir índice compuesto.
  // Filtrado de status se hace client-side en el callback.
  // Sin `tick` en deps — la suscripción es permanente mientras el componente vive.
  useEffect(() => {
    if (!authorized || !vendorId) return;

    // Single-field query: no requiere índice compuesto en Firestore
    const q = query(
      collection(db, "pending_stamps"),
      where("vendorId", "==", vendorId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const stamps: PendingStamp[] = [];
        const toExpire: string[] = [];

        snapshot.docs.forEach((d) => {
          const data = d.data();
          // FIX: filtrar status client-side (evita índice compuesto + evita
          // que Firebase devuelva cache vacío al cambiar deps)
          if (data.status !== "pending") return;

          const createdAt: Timestamp | null = data.createdAt ?? null;
          const elapsed = createdAt
            ? (now - createdAt.toDate().getTime()) / 1000
            : 0;

          if (elapsed > MAX_MINUTES * 60) {
            toExpire.push(d.id);
          } else {
            stamps.push({
              id: d.id,
              userId: data.userId,
              userName: data.userName,
              vendorId: data.vendorId,
              status: data.status,
              createdAt,
            });
          }
        });

        // Expirar silenciosamente — sin bloquear el render
        if (toExpire.length > 0) {
          import("firebase/firestore").then(({ doc: fsDoc, updateDoc }) => {
            toExpire.forEach((id) =>
              updateDoc(fsDoc(db, "pending_stamps", id), { status: "expired" }).catch(() => {})
            );
          });
        }

        setPendingStamps(stamps);
      },
      // FIX: error handler explícito — errores de permisos/red no fallan silenciosamente
      (error) => {
        console.error("[ValidarPanel] onSnapshot error:", error.code, error.message);
        // No resetear pendingStamps — mantener última vista conocida
      }
    );

    return () => unsub();
  }, [authorized, vendorId]); // FIX: sin `tick` — suscripción estable

  // ── Confirmar ─────────────────────────────────────────────────────────────
  const handleConfirm = async (monto: number) => {
    if (!selectedStamp) return;
    setActionLoading(true);
    try {
      await confirmarHandshake(db, selectedStamp.id, monto);
      toast({
        title: "✅ Sello confirmado",
        description: `Sello acreditado a ${selectedStamp.userName}.`,
      });
      setSelectedStamp(null);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al confirmar",
        description: err?.message || "No se pudo confirmar el sello.",
      });
      setSelectedStamp(null);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Rechazar ──────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!selectedStamp) return;
    setActionLoading(true);
    try {
      await rechazarHandshake(db, selectedStamp.id);
      toast({
        title: "Solicitud rechazada",
        description: `Se notificó a ${selectedStamp.userName}.`,
      });
      setSelectedStamp(null);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.message || "No se pudo rechazar la solicitud.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Estados de carga / no autorizado ─────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldCheck className="w-10 h-10 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">Acceso denegado</h2>
          <p className="text-sm text-slate-400 font-medium mt-2">
            Solo el emprendedor de este local puede acceder a este panel.
          </p>
        </div>
        <Button
          onClick={() => router.push("/")}
          className="rounded-2xl font-bold gap-2"
          style={{ backgroundColor: "#D3B673" }}
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al inicio
        </Button>
      </div>
    );
  }

  // ── Panel principal ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-5 pt-safe-top pb-4 pt-4"
        style={{ backgroundColor: "#D3B673" }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/vendedor")}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white transition-colors hover:bg-white/30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
              Panel de Validación
            </p>
            <h1 className="text-lg font-black text-white truncate">{vendorName}</h1>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: pendingStamps.length > 0 ? "#fff" : "rgba(255,255,255,0.4)" }}
            />
            <span className="text-xs font-black text-white">
              {pendingStamps.length} pendiente{pendingStamps.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-lg mx-auto px-5 py-6 space-y-4">

        {/* Instrucción */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-2xl border"
          style={{ backgroundColor: "rgba(211,182,115,0.07)", borderColor: "rgba(211,182,115,0.25)" }}
        >
          <Store className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#D3B673" }} />
          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            Cuando un cliente escanea tu QR, su solicitud aparece aquí.
            Toca la tarjeta para <strong>confirmar</strong> o <strong>rechazar</strong> el sello.
            Las solicitudes expiran a los 5 minutos.
          </p>
        </div>

        {/* Lista de pendientes */}
        {pendingStamps.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
              <Users className="w-10 h-10 text-slate-300" />
            </div>
            <div>
              <p className="text-base font-black text-slate-400">Sin solicitudes</p>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Las nuevas solicitudes aparecerán aquí en tiempo real
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
              Escuchando en tiempo real...
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingStamps.map((stamp) => (
              <StampCard
                key={stamp.id}
                stamp={stamp}
                onClick={() => setSelectedStamp(stamp)}
              />
            ))}
          </div>
        )}

        {/* Leyenda */}
        <div className="pt-4 flex items-center justify-center gap-6 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#D3B673" }} />
            Tiempo normal
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            Menos de 1 min
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedStamp && (
        <ConfirmModal
          stamp={selectedStamp}
          onClose={() => setSelectedStamp(null)}
          onConfirm={handleConfirm}
          onReject={handleReject}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
