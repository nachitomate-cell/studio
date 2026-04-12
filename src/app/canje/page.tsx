"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, collection, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { cancelarPendingStamp } from "@/lib/puntos";
import { SuccessScanner } from "@/components/loyalty/SuccessScanner";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, AlertCircle, ArrowLeft, XCircle, Clock, RefreshCw,
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
      await iniciarHandshake(user.uid, user.displayName || "Miembro", localId);
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

    // ── 4. Escribir en Firestore en background (sin await) ──────────────────
    setDoc(pendingRef, {
      userId,
      userName: userName || "Miembro del Club",
      vendorId,
      status: "pending",
      createdAt: serverTimestamp(),
    })
      .then(() => console.timeEnd("2-create-pending-stamp"))
      .catch(() => {
        if (pendingIdRef.current !== pendingId) return; // ya fue cancelado
        setPhase("error");
        setErrorMsg("No se pudo iniciar la solicitud. Inténtalo de nuevo.");
        pendingIdRef.current = null;
        setPendingId(null);
        processingRef.current = false;
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
