"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { crearPendingStamp, cancelarPendingStamp } from "@/lib/puntos";
import { SuccessScanner } from "@/components/loyalty/SuccessScanner";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, AlertCircle, ArrowLeft, XCircle, Clock, WifiOff, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type Phase =
  | "init"        // verificando auth
  | "creating"    // creando pending_stamp
  | "waiting"     // esperando confirmación del vendedor
  | "confirmed"   // sello confirmado ✅
  | "expired"     // expiró (5 min sin respuesta)
  | "rejected"    // vendedor rechazó
  | "cooldown"    // cooldown de 12h activo
  | "error";      // error genérico

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
  const isCooldown = phase === "cooldown";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm flex flex-col items-center gap-7 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: isExpired
              ? "rgba(245,158,11,0.12)"
              : isCooldown
              ? "rgba(110,187,209,0.12)"
              : "rgba(239,68,68,0.1)",
          }}
        >
          {isExpired ? (
            <Clock className="w-10 h-10 text-amber-500" />
          ) : isCooldown ? (
            <WifiOff className="w-10 h-10" style={{ color: "#6EBBD1" }} />
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
              : isCooldown
              ? "Cooldown activo"
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

// ─── Contenido principal ──────────────────────────────────────────────────────

function CanjeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const localId = searchParams.get("localId");

  const [phase, setPhase] = useState<Phase>("init");
  const [errorMsg, setErrorMsg] = useState("");
  const [vendorName, setVendorName] = useState("el local");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    newTotalSellos: number;
    userDisplayName: string;
  } | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const pendingIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── onSnapshot sobre el pending_stamp ────────────────────────────────────
  useEffect(() => {
    if (!pendingId) return;
    const ref = doc(db, "pending_stamps", pendingId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status === "confirmed") {
        pendingIdRef.current = null;
        setPendingId(null);
        setSuccessData({
          newTotalSellos: data.nuevoTotal ?? 1,
          userDisplayName: data.userName ?? "",
        });
        setPhase("confirmed");
      } else if (data.status === "expired") {
        pendingIdRef.current = null;
        setPendingId(null);
        setPhase("expired");
        setErrorMsg("La solicitud expiró. El vendedor no respondió a tiempo.");
      } else if (data.status === "rejected") {
        pendingIdRef.current = null;
        setPendingId(null);
        setPhase("rejected");
        setErrorMsg("El vendedor no pudo confirmar tu compra. Habla con él directamente.");
      }
    });
    return () => unsub();
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
      await iniciarHandshake(user.uid, user.displayName || "Miembro", localId);
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  // ── Crear pending_stamp ───────────────────────────────────────────────────
  const iniciarHandshake = async (
    userId: string,
    userName: string,
    vendorId: string,
    isRetry = false
  ) => {
    if (isRetry) {
      processingRef.current = true;
      setSecondsElapsed(0);
    }
    setPhase("creating");

    // Resolver nombre del local
    try {
      const { doc: firestoreDoc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(firestoreDoc(db, "entrepreneur_profiles", vendorId));
      if (snap.exists()) {
        const d = snap.data();
        setVendorName(d.businessName || d.nombre || "el local");
      } else {
        const snap2 = await getDoc(firestoreDoc(db, "usuarios", vendorId));
        if (snap2.exists()) {
          const d = snap2.data();
          setVendorName(d.nombreTienda || d.nombre || "el local");
        }
      }
    } catch {
      // nombre de local es cosmético — no bloqueante
    }

    try {
      const id = await crearPendingStamp(db, userId, userName, vendorId);
      pendingIdRef.current = id;
      setPendingId(id);
      setPhase("waiting");
    } catch (err: any) {
      if (
        err?.message?.toLowerCase().includes("esperar") ||
        err?.message?.toLowerCase().includes("horas")
      ) {
        setPhase("cooldown");
        setErrorMsg(err.message);
      } else if (err?.message?.toLowerCase().includes("baneado")) {
        setPhase("error");
        setErrorMsg("Tu cuenta ha sido suspendida.");
      } else {
        setPhase("error");
        setErrorMsg(err?.message || "No se pudo iniciar la solicitud. Inténtalo de nuevo.");
      }
      processingRef.current = false;
    }
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

  if (phase === "expired" || phase === "rejected" || phase === "cooldown" || phase === "error") {
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
