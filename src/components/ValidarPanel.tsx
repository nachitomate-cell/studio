"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection, onSnapshot, query, where, Timestamp, limit,
  getDocs, getDoc, doc, updateDoc, addDoc, serverTimestamp, runTransaction,
} from "firebase/firestore";
import { rechazarHandshake } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, CheckCircle2, XCircle, Clock, ShieldCheck,
  ChevronLeft, User, AlertTriangle, Store, RefreshCw, Gift, Search, Camera, X,
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

const MONTO_MAX = 150_000;
const MONTO_WARN = 50_000;

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

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
  const [showWarning, setShowWarning] = useState(false);
  const [showRequired, setShowRequired] = useState(false);
  const elapsed = getElapsedSeconds(stamp.createdAt);
  const isExpired = elapsed >= MAX_MINUTES * 60;

  const montoNum = parseInt(monto, 10) || 0;
  const isOverLimit = montoNum > MONTO_MAX;
  const isEmpty = monto === "" || montoNum <= 0;

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, "");
    const val = clean === "" ? "" : String(parseInt(clean, 10));
    setMonto(val);
    if (val !== "" && parseInt(val, 10) > 0) setShowRequired(false);
  };

  const handleConfirmClick = () => {
    if (isEmpty) { setShowRequired(true); return; }
    if (isOverLimit) return;
    if (montoNum >= MONTO_WARN) {
      setShowWarning(true);
    } else {
      onConfirm(montoNum);
    }
  };

  if (showWarning) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-black text-slate-800">¿Monto correcto?</h3>
            <p className="text-sm text-slate-500">
              Estás por registrar una venta de{" "}
              <span className="font-black text-slate-800">{formatCLP(montoNum)}</span>.
              ¿Estás seguro de que este valor es correcto?
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => { setShowWarning(false); onConfirm(montoNum); }}
              className="w-full h-12 rounded-2xl font-black text-sm gap-2"
              style={{ backgroundColor: "#D3B673" }}
            >
              <CheckCircle2 className="w-4 h-4" />
              Sí, confirmar {formatCLP(montoNum)}
            </Button>
            <Button
              onClick={() => setShowWarning(false)}
              variant="outline"
              className="w-full h-11 rounded-2xl font-bold text-sm"
            >
              Corregir monto
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
              Monto de la compra{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 5000"
                value={monto}
                onChange={handleMontoChange}
                disabled={loading}
                className={`w-full h-14 pl-8 pr-4 rounded-2xl border-2 focus:outline-none text-lg font-black text-slate-800 bg-slate-50 transition-colors ${
                  isOverLimit || showRequired
                    ? "border-red-400 focus:border-red-500"
                    : "border-slate-200 focus:border-primary"
                }`}
              />
            </div>
            {showRequired && (
              <p className="text-[11px] font-bold text-red-500">
                El monto de la venta es obligatorio para procesar el sello.
              </p>
            )}
            {isOverLimit && (
              <p className="text-[11px] font-bold text-red-500">
                El monto máximo permitido es {formatCLP(MONTO_MAX)}.
              </p>
            )}
            {!showRequired && !isOverLimit && (
              <p className="text-[11px] text-slate-400">
                Máximo {formatCLP(MONTO_MAX)}.
              </p>
            )}
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleConfirmClick}
              disabled={loading || isEmpty || isOverLimit}
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

// ─── Pantalla de celebración ──────────────────────────────────────────────────

function CelebracionEmprendedor({
  canje,
  onClose,
}: {
  canje: { premioNombre: string; premioIcono: string; clienteNombre: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(135deg, #C9920A 0%, #8DC63F 60%, #5BB8D4 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "40px 24px",
        textAlign: "center",
      }}
      onClick={onClose}
    >
      {/* Logo principal */}
      <img
        src="/Logo1.png"
        alt="Patio Curauma"
        style={{
          width: "100px",
          marginBottom: "24px",
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
        }}
      />

      {/* Ícono del premio */}
      <div style={{ fontSize: "80px", marginBottom: "16px", lineHeight: 1 }}>
        {canje.premioIcono || "🎁"}
      </div>

      {/* Título */}
      <h1
        style={{
          color: "white",
          fontSize: "36px",
          fontFamily: "Playfair Display, Georgia, serif",
          fontWeight: 700,
          margin: "0 0 8px",
        }}
      >
        ¡Felicidades!
      </h1>

      {/* Subtítulo */}
      <p style={{ color: "white", fontSize: "18px", margin: "0 0 8px" }}>
        Premio entregado con éxito
      </p>

      {/* Detalle */}
      <p
        style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: "16px",
          margin: "0 0 32px",
        }}
      >
        {canje.clienteNombre} disfrutará su {canje.premioNombre}
      </p>

      {/* Separador + branding */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.3)",
          paddingTop: "24px",
          width: "100%",
          maxWidth: "320px",
        }}
      >
        <p
          style={{
            color: "#FFE082",
            fontSize: "14px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            margin: "0 0 12px",
          }}
        >
          Patio Curauma
        </p>
        <img src="/Logo1.png" alt="" style={{ width: "50px", opacity: 0.7 }} />
      </div>

      <p
        style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: "12px",
          marginTop: "24px",
        }}
      >
        Toca para continuar
      </p>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ValidarPanel({
  vendorId,
  onBack,
}: {
  vendorId: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [vendorName, setVendorName] = useState("Mi Local");
  const [pendingStamps, setPendingStamps] = useState<PendingStamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<PendingStamp | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Estado de validación de premios ──────────────────────────────────────
  const [prizeCode, setPrizeCode] = useState("");
  const [verifyingPrize, setVerifyingPrize] = useState(false);
  const [prizeCanjeData, setPrizeCanjeData] = useState<any>(null);
  const [prizeConfirmLoading, setPrizeConfirmLoading] = useState(false);
  const [prizeSuccess, setPrizeSuccess] = useState<string | null>(null);
  const [mostrarCelebracion, setMostrarCelebracion] = useState(false);
  const [celebracionData, setCelebracionData] = useState<{ premioNombre: string; premioIcono: string; clienteNombre: string } | null>(null);
  const [prizeScannerActive, setPrizeScannerActive] = useState(false);
  const [prizeScannerError, setPrizeScannerError] = useState<string | null>(null);
  const prizeQrRef = useRef<any>(null);

  useEffect(() => {
    return () => { if (prizeQrRef.current) { prizeQrRef.current.stop().catch(() => {}); } };
  }, []);
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

  // ── Escáner QR de premio ──────────────────────────────────────────────────
  const stopPrizeScanner = async () => {
    if (prizeQrRef.current) {
      try { await prizeQrRef.current.stop(); } catch { /* ignore */ }
      prizeQrRef.current = null;
    }
    setPrizeScannerActive(false);
    setPrizeScannerError(null);
  };

  const onPrizeQrScanned = async (text: string) => {
    if (!text.startsWith("canje:")) {
      setPrizeScannerError("QR no es un voucher de premio. Usa el código manual.");
      return;
    }
    const canjeId = text.slice("canje:".length).trim();
    if (!canjeId) {
      setPrizeScannerError("QR inválido.");
      return;
    }

    await stopPrizeScanner();

    setVerifyingPrize(true);
    try {
      const canjeSnap = await getDoc(doc(db, "canjes", canjeId));
      if (!canjeSnap.exists()) {
        toast({ variant: "destructive", title: "Voucher no encontrado", description: "Este QR no corresponde a ningún premio activo." });
        return;
      }
      const data = canjeSnap.data();

      if (data.vendorId !== vendorId) {
        toast({ variant: "destructive", title: "Premio de otro local", description: "Este voucher fue emitido para otro emprendedor." });
        return;
      }
      if (data.status === "used") {
        toast({ variant: "destructive", title: "Código ya utilizado", description: "Este premio ya fue entregado anteriormente." });
        return;
      }
      if (data.status === "expired" || (data.expiraEn && data.expiraEn < new Date().toISOString())) {
        await updateDoc(doc(db, "canjes", canjeId), { status: "expired" });
        toast({ variant: "destructive", title: "Código expirado", description: "Este código ya no es válido." });
        return;
      }

      setPrizeCanjeData({ id: canjeId, ...data });
    } catch (e: any) {
      if (e?.code === "permission-denied") {
        toast({ variant: "destructive", title: "Sin permisos", description: "Este voucher no pertenece a tu local." });
      } else {
        toast({ variant: "destructive", title: "Error", description: e?.message || "No se pudo verificar el QR." });
      }
    } finally {
      setVerifyingPrize(false);
    }
  };

  const startPrizeScanner = async () => {
    setPrizeScannerError(null);
    setPrizeScannerActive(true);
    // Wait for the div to mount
    await new Promise((r) => setTimeout(r, 100));
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("prize-qr-reader");
      prizeQrRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => { onPrizeQrScanned(decodedText); },
        () => { /* scan errors are normal */ }
      );
    } catch (e: any) {
      setPrizeScannerActive(false);
      setPrizeScannerError("No se pudo acceder a la cámara. Usa el código manual.");
    }
  };

  // ── Verificar código de premio ────────────────────────────────────────────
  const handleVerifyPrize = async () => {
    const codigoNormalizado = prizeCode.trim().toUpperCase();
    if (!codigoNormalizado) return;

    setVerifyingPrize(true);
    try {
      const q = query(
        collection(db, "canjes"),
        where("vendorId", "==", vendorId)
      );
      const snap = await getDocs(q);
      const canjeDoc = snap.docs.find((d) => d.data().codigo === codigoNormalizado);

      if (!canjeDoc) {
        toast({ variant: "destructive", title: "Código no encontrado", description: "Verifica el código e intenta de nuevo." });
        return;
      }
      const data = canjeDoc.data();

      if (data.status === "used") {
        toast({ variant: "destructive", title: "Código ya utilizado", description: "Este premio ya fue entregado anteriormente." });
        return;
      }

      if (data.status === "expired" || (data.expiraEn && data.expiraEn < new Date().toISOString())) {
        await updateDoc(doc(db, "canjes", canjeDoc.id), { status: "expired" });
        toast({ variant: "destructive", title: "Código expirado", description: "Este código ya no es válido." });
        return;
      }

      setPrizeCanjeData({ id: canjeDoc.id, ...data });
    } catch (e: any) {
      if (e?.code === "permission-denied") {
        toast({ variant: "destructive", title: "Sin permisos", description: "No tienes permisos para verificar este código. Contacta al administrador." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo verificar el código: " + (e?.message || "intenta de nuevo") });
      }
    } finally {
      setVerifyingPrize(false);
    }
  };

  // ── Confirmar entrega de premio (transacción atómica) ────────────────────
  const handleConfirmPrize = async () => {
    if (!prizeCanjeData) return;
    setPrizeConfirmLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const canjeRef = doc(db, "canjes", prizeCanjeData.id);
        const canjeSnap = await transaction.get(canjeRef);

        if (!canjeSnap.exists()) throw new Error("El código ya no existe.");
        if (canjeSnap.data().status !== "pending") throw new Error("El código ya fue utilizado.");

        transaction.update(canjeRef, {
          status: "used",
          usadoEn: serverTimestamp(),
          confirmadoPor: vendorId,
        });

        const logRef = doc(collection(db, "system_logs"));
        transaction.set(logRef, {
          tipo: "canje_premio",
          premioNombre: prizeCanjeData.premioNombre,
          premioIcono: prizeCanjeData.premioIcono,
          clienteId: prizeCanjeData.clienteId,
          clienteNombre: prizeCanjeData.clienteNombre,
          vendorId,
          codigo: prizeCanjeData.codigo,
          sellosDescontados: prizeCanjeData.sellosDescontados,
          timestamp: serverTimestamp(),
        });
      });

      // Mostrar celebración
      setCelebracionData({
        premioNombre: prizeCanjeData.premioNombre,
        premioIcono: prizeCanjeData.premioIcono,
        clienteNombre: prizeCanjeData.clienteNombre,
      });
      setPrizeCanjeData(null);
      setPrizeCode("");
      setPrizeSuccess(`${prizeCanjeData.clienteNombre} — ${prizeCanjeData.premioNombre}`);
      setMostrarCelebracion(true);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al confirmar", description: e?.message || "Intenta de nuevo." });
    } finally {
      setPrizeConfirmLoading(false);
    }
  };

  // ── Confirmar (server-side via Admin SDK — evita regla Firestore insegura) ──
  const handleConfirm = async (monto: number) => {
    if (!selectedStamp) return;
    setActionLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión activa");

      const res = await fetch("/api/handshake/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ pendingId: selectedStamp.id, monto }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo confirmar el sello.");
      }

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
            onClick={() => onBack ? onBack() : router.push("/vendedor")}
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

        {/* ── SECCIÓN VALIDAR PREMIO ─────────────────────────────────────── */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Gift className="w-4 h-4" style={{ color: "#D3B673" }} />
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Validar Premio</h2>
          </div>

          <div
            className="rounded-3xl border p-5 space-y-4"
            style={{ borderColor: "rgba(211,182,115,0.25)", backgroundColor: "rgba(211,182,115,0.05)" }}
          >
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Escanea el QR del cliente o ingresa el código manualmente.
            </p>

            {/* Botón escanear QR */}
            {!prizeScannerActive ? (
              <Button
                onClick={startPrizeScanner}
                disabled={verifyingPrize}
                className="w-full h-12 rounded-2xl font-bold gap-2"
                style={{ backgroundColor: "#6EBBD1", color: "white" }}
              >
                <Camera className="w-5 h-5" />
                Escanear QR de Premio
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-black" style={{ minHeight: 260 }}>
                  <div id="prize-qr-reader" className="w-full" />
                  <button
                    onClick={stopPrizeScanner}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {verifyingPrize && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-center text-slate-400 font-medium">
                  Apunta la cámara al QR del voucher del cliente
                </p>
              </div>
            )}

            {prizeScannerError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs font-medium text-amber-700">{prizeScannerError}</p>
              </div>
            )}

            {/* Separador */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">o código manual</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                placeholder="Ej: CAFE-X7K2"
                value={prizeCode}
                onChange={(e) => setPrizeCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyPrize()}
                className="flex-1 h-12 px-4 rounded-2xl border-2 border-slate-200 focus:border-primary focus:outline-none text-base font-black text-slate-800 bg-white tracking-widest transition-colors"
                disabled={verifyingPrize}
              />
              <Button
                onClick={handleVerifyPrize}
                disabled={verifyingPrize || !prizeCode.trim()}
                className="h-12 px-4 rounded-2xl font-bold gap-2 shrink-0"
                style={{ backgroundColor: "#D3B673" }}
              >
                {verifyingPrize ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Verificar
              </Button>
            </div>

            {prizeSuccess && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-emerald-800">Premio entregado correctamente ✅</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">{prizeSuccess}</p>
                </div>
                <button
                  onClick={() => setPrizeSuccess(null)}
                  className="ml-auto text-emerald-400 hover:text-emerald-600"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal confirmación de premio */}
      {prizeCanjeData && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setPrizeCanjeData(null); }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4" />
            <div className="px-7 pt-5 pb-8 space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-emerald-50">
                  {prizeCanjeData.premioIcono || "🎁"}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-600">✅ Código válido</p>
                  <h3 className="text-lg font-black text-slate-800">{prizeCanjeData.premioNombre}</h3>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-2 bg-slate-50 rounded-2xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Cliente</span>
                  <span className="font-black text-slate-800">{prizeCanjeData.clienteNombre}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Sellos descontados</span>
                  <span className="font-black text-primary">{prizeCanjeData.sellosDescontados}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Código</span>
                  <span className="font-black text-slate-700 tracking-widest">{prizeCanjeData.codigo}</span>
                </div>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleConfirmPrize}
                  disabled={prizeConfirmLoading}
                  className="w-full h-14 rounded-2xl font-black text-base gap-2 shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  {prizeConfirmLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirmar canje</>}
                </Button>
                <Button
                  onClick={() => setPrizeCanjeData(null)}
                  disabled={prizeConfirmLoading}
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold gap-2 text-slate-500 border-slate-200"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pantalla de celebración */}
      {mostrarCelebracion && celebracionData && (
        <CelebracionEmprendedor
          canje={celebracionData}
          onClose={() => {
            setMostrarCelebracion(false);
            setCelebracionData(null);
          }}
        />
      )}

      {/* Modal sello */}
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
