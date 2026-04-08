"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { registrarCompra } from "@/lib/puntos";
import { SuccessScanner } from "@/components/loyalty/SuccessScanner";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Camera, Loader2, AlertCircle,
  WifiOff, ScanLine, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── tipos de error del escáner ─────────────────────────────────────────────
type ScanError =
  | { type: "invalid_qr" }
  | { type: "not_found" }
  | { type: "cooldown"; message: string }
  | { type: "network" }
  | { type: "camera" };

interface SuccessData {
  vendorName: string;
  userDisplayName: string;
  newTotalSellos: number;
}

// ── utilidades ─────────────────────────────────────────────────────────────
function ErrorBanner({ error, onRetry }: { error: ScanError; onRetry: () => void }) {
  const configs: Record<ScanError["type"], { icon: React.ReactNode; title: string; desc: string }> = {
    invalid_qr: {
      icon: <ShieldAlert className="w-6 h-6 text-red-400" />,
      title: "QR inválido",
      desc: "Este código no pertenece a un local aliado de Club Patio.",
    },
    not_found: {
      icon: <ShieldAlert className="w-6 h-6 text-red-400" />,
      title: "Local no encontrado",
      desc: "El local asociado a este código ya no está disponible.",
    },
    cooldown: {
      icon: <AlertCircle className="w-6 h-6 text-amber-400" />,
      title: "Espera antes de volver",
      desc: "Ya acumulaste un sello en este local recientemente. Necesitas esperar 12 horas.",
    },
    network: {
      icon: <WifiOff className="w-6 h-6 text-slate-400" />,
      title: "Sin conexión",
      desc: "Verifica tu conexión a internet e inténtalo de nuevo.",
    },
    camera: {
      icon: <Camera className="w-6 h-6 text-slate-400" />,
      title: "Sin acceso a cámara",
      desc: "Permite el acceso a la cámara desde los ajustes de tu dispositivo.",
    },
  };

  const cfg = configs[error.type];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="bg-slate-950/95 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {cfg.icon}
          <div>
            <p className="text-white font-bold text-sm">{cfg.title}</p>
            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{cfg.desc}</p>
            {error.type === "cooldown" && "message" in error && (
              <p className="text-amber-400 text-xs mt-1 font-medium">{error.message}</p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onRetry}
          className="w-full bg-primary text-white rounded-xl font-bold"
        >
          Volver a intentar
        </Button>
      </div>
    </div>
  );
}

// ── componente principal ───────────────────────────────────────────────────
export default function ClientScannerPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [scanState, setScanState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [scannerReady, setScannerReady] = useState(false);

  const scannerInstance = useRef<any>(null);
  const isScanningRef = useRef(false); // Guard para evitar doble disparo

  // ── autenticación ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        toast({ variant: "destructive", title: "Inicia Sesión", description: "Debes iniciar sesión para escanear." });
        router.replace("/");
      } else {
        setScannerReady(true);
      }
    });
    return () => {
      unsubscribe();
      stopScanner();
    };
  }, []);

  // ── montar escáner cuando esté listo ──────────────────────────────────
  useEffect(() => {
    if (scannerReady) startScanner();
  }, [scannerReady]);

  // ── control del escáner ───────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setScanError(null);
    setScanState("idle");
    isScanningRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Esperar a que el DOM esté disponible
      await new Promise<void>((res) => setTimeout(res, 350));

      const container = document.getElementById("client-reader");
      if (!container) return;

      // Limpiar instancia anterior si existe
      if (scannerInstance.current) {
        try { await scannerInstance.current.stop(); } catch (_) {}
        scannerInstance.current = null;
      }

      const scanner = new Html5Qrcode("client-reader");
      scannerInstance.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decoded) => onScanSuccess(decoded),
        () => {} // frame-level error, silencioso
      );
    } catch (err: any) {
      console.error("Camera error:", err);
      setScanError({ type: "camera" });
      setScanState("error");
    }
  }, []);

  const stopScanner = async () => {
    if (scannerInstance.current) {
      try {
        if (scannerInstance.current.isScanning) {
          await scannerInstance.current.stop();
        }
      } catch (_) {}
      scannerInstance.current = null;
    }
  };

  // ── lógica del escaneo ────────────────────────────────────────────────
  const onScanSuccess = useCallback(async (decodedText: string) => {
    // Guard: evitar doble disparo mientras se procesa
    if (isScanningRef.current) return;
    isScanningRef.current = true;

    await stopScanner();
    setScanState("loading");

    const raw = decodedText.trim();

    // Validar formato del QR (debe contener un ID de Firebase)
    if (!raw || raw.length < 10) {
      setScanError({ type: "invalid_qr" });
      setScanState("error");
      isScanningRef.current = false;
      return;
    }

    // Extraer el vendorId: soportamos "VND_{uid}" o directamente el uid
    const vendorId = raw.startsWith("VND_") ? raw.replace("VND_", "") : raw;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.replace("/");
      return;
    }

    try {
      // 1. Verificar que el local exista en Firestore
      const vendorRef = doc(db, "entrepreneur_profiles", vendorId);
      const vendorSnap = await getDoc(vendorRef);

      if (!vendorSnap.exists()) {
        setScanError({ type: "not_found" });
        setScanState("error");
        isScanningRef.current = false;
        return;
      }

      const vendorData = vendorSnap.data();
      const shopName = vendorData.businessName || vendorData.nombre || "Local Aliado";

      // 2. Obtener datos del usuario antes de registrar (para mostrar total actualizado)
      const userRef = doc(db, "usuarios", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const prevSellos = userSnap.exists() ? (userSnap.data().comprasRealizadas || 0) : 0;
      const displayName = userSnap.exists() ? (userSnap.data().nombre || "") : "";

      // 3. Registrar la compra (incluye cooldown check)
      await registrarCompra(db, currentUser.uid, vendorId, true);

      // 4. Mostrar pantalla de éxito
      setSuccessData({
        vendorName: shopName,
        userDisplayName: displayName,
        newTotalSellos: prevSellos + 1,
      });
      setScanState("success");

    } catch (error: any) {
      console.error("Scan error:", error);

      // Detectar error de cooldown por mensaje
      if (error?.message?.toLowerCase().includes("esperar") || error?.message?.toLowerCase().includes("horas")) {
        setScanError({ type: "cooldown", message: error.message });
      } else if (error?.code === "unavailable" || error?.message?.toLowerCase().includes("network")) {
        setScanError({ type: "network" });
      } else {
        setScanError({ type: "invalid_qr" });
      }

      setScanState("error");
      isScanningRef.current = false;
    }
  }, [router]);

  const handleRetry = useCallback(() => {
    setScanError(null);
    setScanState("idle");
    startScanner();
  }, [startScanner]);

  // ── pantalla de éxito ─────────────────────────────────────────────────
  if (scanState === "success" && successData) {
    return (
      <SuccessScanner
        vendorName={successData.vendorName}
        userDisplayName={successData.userDisplayName}
        newTotalSellos={successData.newTotalSellos}
        onTimerEnd={() => router.replace("/")}
      />
    );
  }

  // ── UI del escáner ────────────────────────────────────────────────────
  return (
    <main className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe-top pb-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { stopScanner(); router.back(); }}
          className="text-white hover:bg-white/20 rounded-full"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-white text-sm font-bold tracking-widest uppercase">Escanear Local</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Visor de la cámara */}
      <div className="flex-1 relative overflow-hidden">
        <div id="client-reader" className="absolute inset-0 w-full h-full" />

        {/* Overlay visual con esquinas */}
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          {/* Oscurecer los bordes */}
          <div className="absolute inset-0 bg-black/45" />
          {/* Ventana transparente */}
          <div className="relative w-64 h-64 z-10">
            <div className="absolute inset-0 border-2 border-white/20 rounded-2xl" />
            {/* Esquinas animadas */}
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
              "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
              "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"
            ].map((cls, i) => (
              <div key={i} className={`absolute w-7 h-7 border-primary ${cls}`} />
            ))}
            {/* Línea de escaneo animada  */}
            <div
              className="absolute left-2 right-2 h-0.5 bg-primary/80 rounded-full shadow-[0_0_8px_2px_rgba(78,173,31,0.6)]"
              style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }}
            />
          </div>
        </div>

        {/* Loading overlay */}
        {scanState === "loading" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
            <p className="text-white font-bold text-sm tracking-widest uppercase animate-pulse">
              Validando sello...
            </p>
          </div>
        )}

        {/* Error banner */}
        {scanState === "error" && scanError && (
          <ErrorBanner error={scanError} onRetry={handleRetry} />
        )}
      </div>

      {/* Footer con instrucción */}
      <div className="px-6 py-6 bg-gradient-to-t from-black to-transparent text-center space-y-1 z-10">
        <p className="text-white font-bold text-base">Apunta al código QR del mostrador</p>
        <p className="text-slate-400 text-xs">Club Patio · Sistema de fidelización</p>
      </div>

      {/* Keyframe para la línea de scan — inyectado inline */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; opacity: 0.4; }
          50% { top: 90%; opacity: 1; }
        }
      `}</style>
    </main>
  );
}
