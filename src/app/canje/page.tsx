"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { doc, onSnapshot, collection, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { cancelarPendingStamp } from "@/lib/puntos";
import { esAsociado, esMembresia } from "@/lib/tipoComercio";
import { MONTO_MAX, TIER_LABEL, TIER_SELLOS, MembresiaTier } from "@/lib/sellos";
import { SuccessScanner } from "@/components/loyalty/SuccessScanner";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, AlertCircle, ArrowLeft, XCircle, Clock, RefreshCw, Camera, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type Phase =
  | "init"        // verificando auth
  | "creating"    // creando pending_stamp
  | "waiting"     // esperando confirmación del vendedor
  | "boleta"      // comercio asociado: formulario auto-servicio con boleta
  | "membresia"   // gimnasio/membresía: selector de tier + boleta
  | "confirmed"   // sello confirmado ✅
  | "expired"     // expiró (5 min sin respuesta)
  | "rejected"    // vendedor rechazó
  | "error";      // error genérico

const TIER_ORDER: MembresiaTier[] = ["mensual", "trimestral", "semestral", "anual"];

// ─── Waiting UI ─────────────────────────────────────────────────────────────

function WaitingScreen({
  vendorName,
  onCancel,
  secondsElapsed,
}: {
  vendorName: string;
  onCancel: () => void;
  secondsElapsed: number;
}) {
  const MAX_WAIT = 300; // 5 minutos
  const progress = Math.min((secondsElapsed / MAX_WAIT) * 100, 100);
  const minutesLeft = Math.max(0, Math.floor((MAX_WAIT - secondsElapsed) / 60));
  const secsLeft = Math.max(0, (MAX_WAIT - secondsElapsed) % 60);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 text-center">

        {/* Spinner animado */}
        <div className="relative flex items-center justify-center">
          <div
            className="w-28 h-28 rounded-full border-4 border-slate-200 animate-spin"
            style={{
              borderTopColor: "#D3B673",
              animationDuration: "1.4s",
            }}
          />
          <div
            className="absolute w-20 h-20 rounded-full animate-pulse"
            style={{ backgroundColor: "rgba(211,182,115,0.12)" }}
          />
          <Clock className="absolute w-8 h-8" style={{ color: "#D3B673" }} />
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800">Esperando confirmación</h2>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Esperando que{" "}
            <span className="font-black" style={{ color: "#D3B673" }}>
              {vendorName}
            </span>{" "}
            apruebe tu sello...
          </p>
          <p className="text-xs text-slate-400">
            Muéstrale esta pantalla al vendedor
          </p>
        </div>

        {/* Barra de tiempo */}
        <div className="w-full space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-400 px-1">
            <span>Tiempo restante</span>
            <span className="tabular-nums">
              {String(minutesLeft).padStart(2, "0")}:{String(secsLeft).padStart(2, "0")}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${100 - progress}%`,
                backgroundColor: progress > 80 ? "#ef4444" : "#D3B673",
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400">Expira en 5 minutos si no hay respuesta</p>
        </div>

        {/* Puntos animados */}
        <div className="flex items-center gap-2">
          {[0, 0.2, 0.4].map((delay, i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full animate-bounce"
              style={{
                backgroundColor: "#D3B673",
                animationDelay: `${delay}s`,
                animationDuration: "0.9s",
              }}
            />
          ))}
        </div>

        {/* Cancelar */}
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors px-4 py-2 rounded-xl hover:bg-slate-100"
        >
          <XCircle className="w-4 h-4" />
          Cancelar solicitud
        </button>
      </div>
    </div>
  );
}

// ─── Pantalla de estado final (no éxito) ─────────────────────────────────────

function ResultScreen({
  phase,
  errorMsg,
  vendorName,
  onRetry,
  onHome,
}: {
  phase: Phase;
  errorMsg: string;
  vendorName: string;
  onRetry: () => void;
  onHome: () => void;
}) {
  const isExpired = phase === "expired";
  const isRejected = phase === "rejected";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm flex flex-col items-center gap-7 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: isExpired
              ? "rgba(245,158,11,0.12)"
              : "rgba(239,68,68,0.1)",
          }}
        >
          {isExpired ? (
            <Clock className="w-10 h-10 text-amber-500" />
          ) : (
            <AlertCircle className="w-10 h-10 text-red-500" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-800">
            {isExpired
              ? "Solicitud expirada"
              : isRejected
              ? "Sello no confirmado"
              : "Algo salió mal"}
          </h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{errorMsg}</p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          {(isExpired || isRejected) && (
            <Button
              onClick={onRetry}
              className="w-full h-12 rounded-2xl font-bold gap-2"
              style={{ backgroundColor: "#D3B673" }}
            >
              <RefreshCw className="w-4 h-4" />
              Intentar de nuevo
            </Button>
          )}
          <Button
            onClick={onHome}
            variant="outline"
            className="w-full h-12 rounded-2xl font-bold gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulario de boleta (comercios asociados / auto-servicio) ───────────────

function BoletaForm({
  vendorName,
  onSubmit,
  onCancel,
  loading,
  monto,
  setMonto,
  preview,
  fileRef,
  setPreview,
}: {
  vendorName: string;
  onSubmit: (monto: number) => void;
  onCancel: () => void;
  loading: boolean;
  monto: string;
  setMonto: (v: string) => void;
  preview: string | null;
  fileRef: React.MutableRefObject<File | null>;
  setPreview: (v: string | null) => void;
}) {
  const montoNum = parseInt(monto, 10) || 0;
  const isOverLimit = montoNum > MONTO_MAX;
  const canSubmit = montoNum > 0 && !isOverLimit && !!preview && !loading;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    fileRef.current = f;
    if (!f) { setPreview(null); return; }
    // Convertir a DataURL para que sobreviva un remount de la página
    // (iOS Safari descarga la pestaña al abrir la cámara y vuelve a montar
    // todo el árbol React al regresar — un blob URL no sobrevive a eso).
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-7 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: "rgba(211,182,115,0.12)" }}>
            <Receipt className="w-7 h-7" style={{ color: "#D3B673" }} />
          </div>
          <h2 className="text-xl font-black text-slate-800">Registra tu compra</h2>
          <p className="text-sm text-slate-500">
            en <span className="font-black" style={{ color: "#D3B673" }}>{vendorName}</span>
          </p>
        </div>

        {/* Monto */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Monto de la compra <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 5000"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              className={`w-full h-14 pl-8 pr-4 rounded-2xl border-2 focus:outline-none text-lg font-black text-slate-800 bg-slate-50 transition-colors ${
                isOverLimit ? "border-red-400" : "border-slate-200 focus:border-primary"
              }`}
            />
          </div>
          {isOverLimit && (
            <p className="text-[11px] font-bold text-red-500">
              El monto máximo es ${MONTO_MAX.toLocaleString("es-CL")}.
            </p>
          )}
        </div>

        {/* Foto de la boleta */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Foto de la boleta <span className="text-red-500">*</span>
          </label>
          <label className="flex flex-col items-center justify-center gap-2 w-full min-h-[120px] rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 cursor-pointer overflow-hidden">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Boleta" className="w-full h-full max-h-48 object-contain" />
            ) : (
              <>
                <Camera className="w-8 h-8 text-slate-400" />
                <span className="text-xs font-bold text-slate-400">Toca para tomar/elegir foto</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={() => preview && onSubmit(montoNum)}
            disabled={!canSubmit}
            className="w-full h-14 rounded-2xl font-black text-base gap-2 shadow-lg"
            style={{ backgroundColor: "#D3B673" }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Obtener mis sellos"}
          </Button>
          <Button
            onClick={onCancel}
            disabled={loading}
            variant="outline"
            className="w-full h-12 rounded-2xl font-bold text-slate-500 border-slate-200"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulario de membresía (gimnasios / planes con tier) ───────────────────

function MembresiaForm({
  vendorName,
  onSubmit,
  onCancel,
  loading,
  tier,
  setTier,
  preview,
  fileRef,
  setPreview,
}: {
  vendorName: string;
  onSubmit: (tier: MembresiaTier) => void;
  onCancel: () => void;
  loading: boolean;
  tier: MembresiaTier | null;
  setTier: (t: MembresiaTier) => void;
  preview: string | null;
  fileRef: React.MutableRefObject<File | null>;
  setPreview: (v: string | null) => void;
}) {
  const canSubmit = !!tier && !!preview && !loading;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    fileRef.current = f;
    if (!f) { setPreview(null); return; }
    // DataURL para sobrevivir el remount al abrir la cámara nativa en iOS.
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-7 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: "rgba(211,182,115,0.12)" }}>
            <Receipt className="w-7 h-7" style={{ color: "#D3B673" }} />
          </div>
          <h2 className="text-xl font-black text-slate-800">Elige tu plan</h2>
          <p className="text-sm text-slate-500">
            en <span className="font-black" style={{ color: "#D3B673" }}>{vendorName}</span>
          </p>
        </div>

        {/* Selector de tier */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Plan contratado <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIER_ORDER.map((t) => {
              const isSelected = tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  disabled={loading}
                  className={`flex flex-col items-center justify-center gap-1 h-20 rounded-2xl border-2 transition-all font-bold ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                  style={isSelected ? { borderColor: "#D3B673", backgroundColor: "rgba(211,182,115,0.12)" } : undefined}
                >
                  <span className={`text-sm ${isSelected ? "text-slate-800" : "text-slate-600"}`}>
                    {TIER_LABEL[t]}
                  </span>
                  <span className="text-[11px] font-black" style={{ color: isSelected ? "#D3B673" : "#94a3b8" }}>
                    +{TIER_SELLOS[t]} sellos
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Foto de la boleta */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Foto de la boleta / comprobante <span className="text-red-500">*</span>
          </label>
          <label className="flex flex-col items-center justify-center gap-2 w-full min-h-[120px] rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 cursor-pointer overflow-hidden">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Boleta" className="w-full h-full max-h-48 object-contain" />
            ) : (
              <>
                <Camera className="w-8 h-8 text-slate-400" />
                <span className="text-xs font-bold text-slate-400">Toca para tomar/elegir foto</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={() => tier && onSubmit(tier)}
            disabled={!canSubmit}
            className="w-full h-14 rounded-2xl font-black text-base gap-2 shadow-lg"
            style={{ backgroundColor: "#D3B673" }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              tier ? `Obtener mis ${TIER_SELLOS[tier]} sellos` : "Elige un plan"
            )}
          </Button>
          <Button
            onClick={onCancel}
            disabled={loading}
            variant="outline"
            className="w-full h-12 rounded-2xl font-bold text-slate-500 border-slate-200"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Contenido principal ──────────────────────────────────────────────────────

// Clave de sessionStorage para persistir el estado del formulario de boleta
// y sobrevivir a un remount completo (iOS Safari recarga la pestaña al abrir
// la cámara nativa). Scoped por localId para no mezclar comercios.
const BOLETA_STORAGE_KEY = (localId: string) => `boleta_state_v1_${localId}`;

interface BoletaPersistedState {
  phase: "boleta" | "membresia";
  vendorName: string;
  monto: string;                   // usado solo en "boleta"
  tier: MembresiaTier | null;      // usado solo en "membresia"
  preview: string | null;          // DataURL — sobrevive al remount
}

function loadBoletaState(localId: string | null): BoletaPersistedState | null {
  if (!localId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BOLETA_STORAGE_KEY(localId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoletaPersistedState;
    if (parsed?.phase !== "boleta" && parsed?.phase !== "membresia") return null;
    return parsed;
  } catch { return null; }
}

function CanjeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const localId = searchParams.get("localId");

  // Hidratación síncrona desde sessionStorage: si veníamos de tomar una foto y
  // la pestaña se descargó, partimos directo en "boleta" con monto y preview
  // restaurados — sin flash de "Verificando...".
  const initialBoleta = loadBoletaState(localId);

  const [phase, setPhase] = useState<Phase>(initialBoleta ? initialBoleta.phase : "init");
  const [errorMsg, setErrorMsg] = useState("");
  const [vendorName, setVendorName] = useState(initialBoleta?.vendorName ?? "el local");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    newTotalSellos: number;
    userDisplayName: string;
  } | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [boletaLoading, setBoletaLoading] = useState(false);

  // Estado de los formularios auto-servicio (boleta + membresía). Hoisted aquí
  // para que persista a través de los re-renders. El File no se serializa pero
  // el preview en DataURL alcanza para reconstruirlo al enviar.
  const [boletaMonto, setBoletaMonto] = useState<string>(initialBoleta?.monto ?? "");
  const [membresiaTier, setMembresiaTier] = useState<MembresiaTier | null>(initialBoleta?.tier ?? null);
  const [boletaPreview, setBoletaPreview] = useState<string | null>(initialBoleta?.preview ?? null);
  const boletaFileRef = useRef<File | null>(null);

  const pendingIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persistir estado del formulario auto-servicio cuando esté activo. Si la
  // pestaña se descarga (iOS al abrir cámara), volvemos a este mismo punto al
  // volver. Cubre boleta y membresía con la misma clave.
  useEffect(() => {
    if (!localId) return;
    if (phase !== "boleta" && phase !== "membresia") {
      try { sessionStorage.removeItem(BOLETA_STORAGE_KEY(localId)); } catch { /* */ }
      return;
    }
    try {
      const payload: BoletaPersistedState = {
        phase,
        vendorName,
        monto: boletaMonto,
        tier: membresiaTier,
        preview: boletaPreview,
      };
      sessionStorage.setItem(BOLETA_STORAGE_KEY(localId), JSON.stringify(payload));
    } catch {
      // QuotaExceeded en fotos muy grandes — no es crítico.
    }
  }, [localId, phase, vendorName, boletaMonto, membresiaTier, boletaPreview]);

  // ── Precalentar conexión Firestore al montar (establece WebSocket antes del escaneo) ──
  useEffect(() => {
    getDoc(doc(db, "config", "app")).catch(() => {});
  }, []);

  // ── Limpiar cooldowns legacy guardados en localStorage ───────────────────
  useEffect(() => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("cooldown_")) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // ── Limpiar pending al desmontar si sigue en espera ─────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pendingIdRef.current) {
        cancelarPendingStamp(db, pendingIdRef.current).catch(() => {});
      }
    };
  }, []);

  // ── Timer de segundos para la barra de progreso ──────────────────────────
  useEffect(() => {
    if (phase === "waiting") {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((s) => {
          if (s >= 300) {
            // 5 minutos: expirar localmente
            clearInterval(timerRef.current!);
            setPhase("expired");
            setErrorMsg("La solicitud expiró sin respuesta. Inténtalo de nuevo.");
            if (pendingIdRef.current) {
              cancelarPendingStamp(db, pendingIdRef.current).catch(() => {});
              pendingIdRef.current = null;
              setPendingId(null);
            }
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // ── onSnapshot + polling de respaldo + reconexión al volver del background ──
  useEffect(() => {
    if (!pendingId) return;

    let confirmed = false; // flag para evitar doble disparo
    let unsub: (() => void) | undefined;
    let pollingInterval: ReturnType<typeof setInterval> | undefined;

    // Declarar con let para que handleSnap pueda referenciarla antes de la asignación
    // eslint-disable-next-line prefer-const
    let handleVisibility: () => void;

    // Cerrar todos los mecanismos de escucha
    const cleanup = () => {
      unsub?.();
      clearInterval(pollingInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };

    // Procesar snapshot (compartido entre onSnapshot y polling)
    const handleSnap = (snap: { exists: () => boolean; data: () => any }) => {
      if (confirmed || !snap.exists()) return;
      const data = snap.data();
      const status: string | undefined = data?.status;

      console.log("[Celebración] Status recibido:", status);

      if (status === "confirmed") {
        confirmed = true;
        cleanup();
        pendingIdRef.current = null;
        setPendingId(null);
        setSuccessData({
          newTotalSellos: data.nuevoTotal ?? 1,
          userDisplayName: data.userName ?? "",
        });
        console.log("[Celebración] ¡Mostrando celebración!");
        setPhase("confirmed");
      } else if (status === "expired") {
        confirmed = true;
        cleanup();
        pendingIdRef.current = null;
        setPendingId(null);
        setPhase("expired");
        setErrorMsg("La solicitud expiró. El vendedor no respondió a tiempo.");
      } else if (status === "rejected") {
        confirmed = true;
        cleanup();
        pendingIdRef.current = null;
        setPendingId(null);
        setPhase("rejected");
        setErrorMsg("El vendedor no pudo confirmar tu compra. Habla con él directamente.");
      }
    };

    // Suscribir onSnapshot (con reconexión automática si falla)
    const subscribe = () => {
      unsub?.(); // limpiar suscripción anterior si existe
      console.log("[Celebración] Conectando onSnapshot para:", pendingId);
      const ref = doc(db, "pending_stamps", pendingId);
      unsub = onSnapshot(
        ref,
        (snap) => handleSnap(snap),
        (error) => {
          console.error("[Celebración] onSnapshot error:", error);
          // Reintentar en 2 segundos si aún no confirmado
          setTimeout(() => { if (!confirmed) subscribe(); }, 2000);
        }
      );
    };

    subscribe();

    // Polling de respaldo cada 3 segundos — captura lo que onSnapshot pierda
    pollingInterval = setInterval(async () => {
      if (confirmed) return;
      try {
        console.log("[Polling] Verificando status de:", pendingId);
        const snap = await getDoc(doc(db, "pending_stamps", pendingId));
        handleSnap(snap);
      } catch (e) {
        console.error("[Polling] Error:", e);
      }
    }, 3000);

    // Reconectar cuando la PWA vuelve al primer plano (iOS/Android suspende el WS)
    handleVisibility = () => {
      if (document.visibilityState === "visible" && !confirmed) {
        console.log("[Celebración] App volvió al frente — reconectando onSnapshot...");
        subscribe();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => cleanup();
  }, [pendingId]);

  // ── Arrancar flujo al conocer el usuario ─────────────────────────────────
  useEffect(() => {
    if (!localId) {
      setPhase("error");
      setErrorMsg("Código de local inválido.");
      return;
    }

    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("url_retorno", window.location.href);
        }
        toast({
          title: "Un paso más 🚀",
          description: "Regístrate o inicia sesión para recibir tu sello.",
        });
        router.push("/?login=true");
        return;
      }
      if (processingRef.current) return;
      processingRef.current = true;

      // Restauración tibia: si ya veníamos en flujo de boleta (hidratado desde
      // sessionStorage tras un remount por la cámara), no reiniciamos el flujo.
      // Solo verificamos ban en background y dejamos al usuario donde estaba.
      if (initialBoleta) {
        getDoc(doc(db, "usuarios", user.uid))
          .then((snap) => {
            if (snap.exists() && snap.data().baneado) {
              setPhase("error");
              setErrorMsg("Tu cuenta ha sido suspendida.");
            }
          })
          .catch(() => { /* best-effort */ });
        return;
      }

      // Preferir nombre de Firestore — displayName es null en cuentas email/password
      let nombreCliente = user.displayName || "Miembro";
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) nombreCliente = snap.data().nombre || nombreCliente;
      } catch { /* best-effort */ }

      // ── Detectar tipo de comercio ──────────────────────────────────────────
      // Asociado  → flujo auto-servicio con boleta (monto + foto).
      // Membresía → flujo auto-servicio con tier fijo (gimnasios + foto).
      // Emprendedor (o si falla la lectura) → flujo handshake normal.
      try {
        const vSnap = await getDoc(doc(db, "entrepreneur_profiles", localId));
        if (vSnap.exists()) {
          setVendorName(vSnap.data().businessName || vSnap.data().nombre || "el local");
          if (esMembresia(vSnap.data())) {
            setPhase("membresia");
            return;
          }
          if (esAsociado(vSnap.data())) {
            setPhase("boleta");
            return;
          }
        }
      } catch { /* si falla, cae al handshake normal */ }

      await iniciarHandshake(user.uid, nombreCliente, localId);
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  // ── Crear pending_stamp (optimizado: spinner primero, Firestore después) ──
  const iniciarHandshake = async (
    userId: string,
    userName: string,
    vendorId: string,
    isRetry = false
  ) => {
    console.time("total-scan");
    if (isRetry) {
      processingRef.current = true;
      setSecondsElapsed(0);
    }

    // ── 1. Nombre del local desde caché localStorage ────────────────────────
    const nameCacheKey = `vendor_name_${vendorId}`;
    const cachedName = localStorage.getItem(nameCacheKey);
    if (cachedName) setVendorName(cachedName);

    // ── 2. Pre-generar ref local (sin red) y registrar pendingId ───────────
    console.time("2-create-pending-stamp");
    const pendingRef = doc(collection(db, "pending_stamps"));
    const pendingId = pendingRef.id;
    pendingIdRef.current = pendingId;
    setPendingId(pendingId);

    // ── 3. Mostrar spinner INMEDIATAMENTE ───────────────────────────────────
    console.time("3-show-spinner");
    setPhase("waiting");
    console.timeEnd("3-show-spinner");
    console.timeEnd("total-scan");

    // ── 4. Capturar geolocalización (SOLO marketing/proximidad, NO bloqueante) ──
    // El geofence NUNCA bloquea el sello: la presencia física la valida el vendedor
    // al confirmar manualmente. Estas coords son best-effort para futuras alertas de
    // proximidad. Si el usuario deniega el permiso o el GPS falla/tarda, resolvemos
    // null en silencio y el pending_stamp se crea igual. Timeout corto + posición
    // cacheada para no añadir fricción al flujo de ganar sellos.
    const obtenerCoordenadas = (): Promise<{ lat: number; lng: number } | null> =>
      new Promise((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 2000, maximumAge: 60000 }
        );
      });

    // ── 5. Escribir en Firestore en background (sin await) ──────────────────
    obtenerCoordenadas().then((coords) => {
      setDoc(pendingRef, {
        userId,
        userName: userName || "Miembro del Club",
        vendorId,
        status: "pending",
        createdAt: serverTimestamp(),
        ...(coords ? { clientLat: coords.lat, clientLng: coords.lng } : {}),
      })
        .then(() => {
          console.timeEnd("2-create-pending-stamp");
          // ✓ Notificar al vendedor: pasamos pendingId para que el servidor
          // lea el vendorId directamente desde Firestore (evita que el cliente
          // pueda alterar el destinatario de la notificación).
          fetch("/api/handshake/notify-vendor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pendingId, clientName: userName || "Un cliente" }),
          }).catch(() => {/* silencioso — no bloquear el flujo */});
        })
        .catch(() => {
          if (pendingIdRef.current !== pendingId) return; // ya fue cancelado
          setPhase("error");
          setErrorMsg("No se pudo iniciar la solicitud. Inténtalo de nuevo.");
          pendingIdRef.current = null;
          setPendingId(null);
          processingRef.current = false;
        });
    });

    // ── 5. Fetch nombre del local + verificar ban en paralelo (background) ──
    const fetchName = cachedName
      ? Promise.resolve()
      : getDoc(doc(db, "entrepreneur_profiles", vendorId))
          .then((snap) => {
            if (snap.exists()) {
              const name = snap.data().businessName || snap.data().nombre || "el local";
              setVendorName(name);
              localStorage.setItem(nameCacheKey, name);
              return;
            }
            return getDoc(doc(db, "usuarios", vendorId)).then((snap2) => {
              if (snap2.exists()) {
                const d = snap2.data();
                const name = d.nombreTienda || d.nombre || "el local";
                setVendorName(name);
                localStorage.setItem(nameCacheKey, name);
              }
            });
          })
          .catch(() => {});

    const verifyUser = getDoc(doc(db, "usuarios", userId))
      .then((userSnap) => {
        // Guard: si el sello ya fue confirmado/cancelado, no sobrescribir la fase.
        // Sin este guard, verifyUser puede resolver DESPUÉS de que el onSnapshot
        // haya seteado phase="confirmed", y al ver lastVendorScans recién actualizado
        // por confirmarHandshake, confundiría la confirmación con una fase activa.
        if (pendingIdRef.current !== pendingId) return;
        if (!userSnap.exists()) return;
        const data = userSnap.data();

        if (data.baneado) {
          cancelarPendingStamp(db, pendingId).catch(() => {});
          pendingIdRef.current = null;
          setPendingId(null);
          setPhase("error");
          setErrorMsg("Tu cuenta ha sido suspendida.");
          processingRef.current = false;
          return;
        }
      })
      .catch(() => {});

    Promise.all([fetchName, verifyUser]).catch(() => {});
  };

  // ── Cancelar manualmente ──────────────────────────────────────────────────
  const handleCancel = async () => {
    if (pendingIdRef.current) {
      await cancelarPendingStamp(db, pendingIdRef.current).catch(() => {});
      pendingIdRef.current = null;
      setPendingId(null);
    }
    processingRef.current = false;
    router.push("/");
  };

  // ── Enviar boleta (asociado o membresía) ──────────────────────────────────
  // El cuerpo difiere: asociado manda { monto }, membresía manda { tier }.
  // La subida de la foto y los toasts de error son comunes.
  const enviarBoletaConPayload = async (
    extraBody: { monto: number } | { tier: MembresiaTier }
  ) => {
    const user = auth.currentUser;
    if (!user || !localId) return;

    // Resolver el archivo a subir. Caso A: el File está en memoria (recién tomado).
    // Caso B: la pestaña se descargó al abrir la cámara y hidratamos desde
    // sessionStorage — solo tenemos el preview en DataURL. Reconstruimos un Blob.
    let blob: Blob | null = boletaFileRef.current;
    let contentType = "image/jpeg";
    if (!blob && boletaPreview && boletaPreview.startsWith("data:")) {
      try {
        const res = await fetch(boletaPreview);
        blob = await res.blob();
        contentType = blob.type || "image/jpeg";
      } catch {
        toast({ variant: "destructive", title: "Foto perdida", description: "Vuelve a tomar la foto e inténtalo de nuevo." });
        return;
      }
    } else if (blob) {
      contentType = blob.type || "image/jpeg";
    }
    if (!blob) {
      toast({ variant: "destructive", title: "Falta la foto", description: "Toma una foto de la boleta antes de enviar." });
      return;
    }

    if (!contentType.startsWith("image/")) {
      toast({ variant: "destructive", title: "Archivo inválido", description: "Debes subir una foto de la boleta (imagen)." });
      return;
    }
    if (blob.size > 15 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Foto muy pesada", description: "La imagen supera 15 MB. Usa una foto más liviana." });
      return;
    }

    setBoletaLoading(true);
    try {
      const idToken = await user.getIdToken();
      // Subir foto a Storage. NO leemos la URL aquí: la regla de lectura es
      // solo-staff (privacidad); el cliente solo sube y envía el path.
      const path = `boletas/${localId}/${Date.now()}_${user.uid}.jpg`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, blob, { contentType });

      const res = await fetch("/api/handshake/boleta-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ vendorId: localId, boletaPath: path, ...extraBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar el sello.");

      // Limpiar estado persistido — la boleta ya fue procesada
      try { sessionStorage.removeItem(BOLETA_STORAGE_KEY(localId)); } catch { /* */ }
      boletaFileRef.current = null;
      setBoletaPreview(null);
      setBoletaMonto("");
      setMembresiaTier(null);

      setSuccessData({
        newTotalSellos: data.nuevoTotal ?? 1,
        userDisplayName: data.userName ?? "",
      });
      setPhase("confirmed");
    } catch (e: any) {
      toast({ variant: "destructive", title: "No se pudo registrar", description: e?.message || "Inténtalo de nuevo." });
    } finally {
      setBoletaLoading(false);
    }
  };

  const enviarBoleta = (monto: number) => enviarBoletaConPayload({ monto });
  const enviarMembresia = (tier: MembresiaTier) => enviarBoletaConPayload({ tier });

  // ── Reintentar (después de expired/rejected) ──────────────────────────────
  const handleRetry = () => {
    if (!localId) return;
    const user = auth.currentUser;
    if (!user) { router.push("/?login=true"); return; }
    iniciarHandshake(user.uid, user.displayName || "Miembro", localId, true);
  };

  // ── Renders según fase ────────────────────────────────────────────────────

  if (phase === "init" || phase === "creating") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: "#D3B673" }} />
          <p className="text-sm font-bold text-slate-500">
            {phase === "creating" ? "Iniciando solicitud..." : "Verificando..."}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <WaitingScreen
        vendorName={vendorName}
        onCancel={handleCancel}
        secondsElapsed={secondsElapsed}
      />
    );
  }

  if (phase === "boleta") {
    return (
      <BoletaForm
        vendorName={vendorName}
        onSubmit={enviarBoleta}
        onCancel={() => {
          if (localId) {
            try { sessionStorage.removeItem(BOLETA_STORAGE_KEY(localId)); } catch { /* */ }
          }
          router.push("/");
        }}
        loading={boletaLoading}
        monto={boletaMonto}
        setMonto={setBoletaMonto}
        preview={boletaPreview}
        setPreview={setBoletaPreview}
        fileRef={boletaFileRef}
      />
    );
  }

  if (phase === "membresia") {
    return (
      <MembresiaForm
        vendorName={vendorName}
        onSubmit={enviarMembresia}
        onCancel={() => {
          if (localId) {
            try { sessionStorage.removeItem(BOLETA_STORAGE_KEY(localId)); } catch { /* */ }
          }
          router.push("/");
        }}
        loading={boletaLoading}
        tier={membresiaTier}
        setTier={setMembresiaTier}
        preview={boletaPreview}
        setPreview={setBoletaPreview}
        fileRef={boletaFileRef}
      />
    );
  }

  if (phase === "confirmed" && successData) {
    return (
      <SuccessScanner
        vendorName={vendorName}
        userDisplayName={successData.userDisplayName}
        newTotalSellos={successData.newTotalSellos}
        onTimerEnd={() => router.push("/")}
      />
    );
  }

  if (phase === "expired" || phase === "rejected" || phase === "error") {
    return (
      <ResultScreen
        phase={phase}
        errorMsg={errorMsg}
        vendorName={vendorName}
        onRetry={handleRetry}
        onHome={() => router.push("/")}
      />
    );
  }

  return null;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default function CanjePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: "#D3B673" }} />
        </div>
      }
    >
      <CanjeContent />
    </Suspense>
  );
}
