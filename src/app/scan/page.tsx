"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Camera, Loader2,
  WifiOff, ScanLine, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ScanError =
  | { type: "invalid_qr" }
  | { type: "not_found" }
  | { type: "network" }
  | { type: "camera" }
  | { type: "client_qr" };

function ErrorBanner({ error, onRetry }: { error: ScanError; onRetry: () => void }) {
  const configs: Record<ScanError["type"], { icon: React.ReactNode; title: string; desc: string }> = {
    invalid_qr: {
      icon: <ShieldAlert className="w-6 h-6 text-red-400" />,
      title: "QR no reconocido",
      desc: "Este código no corresponde a un local de Club Patio. Asegúrate de escanear el QR oficial del mostrador.",
    },
    not_found: {
      icon: <ShieldAlert className="w-6 h-6 text-red-400" />,
      title: "Local no encontrado",
      desc: "El local asociado a este código ya no está disponible.",
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
    client_qr: {
      icon: <ShieldAlert className="w-6 h-6 text-amber-400" />,
      title: "QR de otro socio",
      desc: "Este es el código de otro socio. Para sumar sellos, debes escanear el QR de un emprendedor adherido, o pedirle al local que escanee tu pantalla.",
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

export default function ClientScannerPage() {
  const router = useRouter();
  const { toast } = useToast();

  // "redirecting" → llegó con ?ref= o sin sesión, mostrando spinner mientras redirige
  // "scanner"    → modo normal, mostrar cámara directamente
  const [mode, setMode] = useState<"redirecting" | "scanner">("scanner");

  const [scanState, setScanState] = useState<"idle" | "loading" | "error">("idle");
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [scannerReady, setScannerReady] = useState(false);

  const scannerInstance = useRef<any>(null);
  const isScanningRef = useRef(false);

  const startScannerForUser = useCallback((user: import("firebase/auth").User) => {
    getDoc(doc(db, "entrepreneur_profiles", user.uid)).then((snap) => {
      if (snap.exists()) {
        router.replace("/vendedor?action=scan");
      } else {
        setMode("scanner");
        setScannerReady(true);
      }
    }).catch(() => {
      setMode("scanner");
      setScannerReady(true);
    });
  }, [router]);

  // ── Lógica de entrada ──────────────────────────────────────────────────────
  useEffect(() => {
    const ref = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("ref")
      : null;

    // ── MODO QR UNIVERSAL (?ref=) ─────────────────────────────────────────
    if (ref) {
      setMode("redirecting");
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        if (user) {
          router.replace(`/canje?localId=${ref}`);
        } else {
          localStorage.setItem("referral_local_id", ref);
          localStorage.setItem("url_retorno", `/canje?localId=${ref}`);
          router.replace("/unete");
        }
      });
      return () => { unsubscribe(); stopScanner(); };
    }

    // ── MODO ESCÁNER NORMAL ───────────────────────────────────────────────
    // Ruta rápida: auth.currentUser ya está disponible si el usuario tiene sesión activa
    const cachedUser = auth.currentUser;
    if (cachedUser) {
      startScannerForUser(cachedUser);
      return () => { stopScanner(); };
    }

    // Ruta lenta: Firebase aún inicializando (primera carga / cold start)
    setMode("redirecting");
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (!user) {
        toast({
          variant: "destructive",
          title: "Inicia Sesión",
          description: "Debes iniciar sesión para escanear.",
        });
        router.replace("/");
      } else {
        startScannerForUser(user);
      }
    });

    return () => {
      unsubscribe();
      stopScanner();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scannerReady) startScanner();
  }, [scannerReady]);

  const startScanner = useCallback(async () => {
    setScanError(null);
    setScanState("idle");
    isScanningRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      await new Promise<void>((res) => setTimeout(res, 350));

      const container = document.getElementById("client-reader");
      if (!container) return;

      if (scannerInstance.current) {
        try { await scannerInstance.current.stop(); } catch (_) {}
        scannerInstance.current = null;
      }

      const scanner = new Html5Qrcode("client-reader", { verbose: false });
      scannerInstance.current = scanner;

      const shortSide = Math.min(container.offsetWidth, container.offsetHeight);
      const boxSize = Math.round(shortSide * 0.72);

      await scanner.start(
        { facingMode: { ideal: "environment" } },
        {
          fps: 15,
          qrbox: { width: boxSize, height: boxSize },
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decoded) => onScanSuccess(decoded),
        () => {}
      );
      // Cámara concedida — recordar para iOS (no soporta Permissions API)
      localStorage.setItem("camera_permission_granted", "true");
    } catch (err: any) {
      console.error("Camera error:", err);
      localStorage.removeItem("camera_permission_granted");
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

  const onScanSuccess = useCallback(async (decodedText: string) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;

    await stopScanner();
    setScanState("loading");

    const raw = decodedText.trim();

    if (!raw) {
      setScanError({ type: "invalid_qr" });
      setScanState("error");
      isScanningRef.current = false;
      return;
    }

    // Extraer vendorId — soporta 3 formatos:
    // 1. URL con ?localId= o ?ref=
    // 2. Formato legacy VND_{uid}
    // 3. UID directo
    let vendorId = "";

    if (raw.includes("localId=") || raw.includes("ref=")) {
      try {
        const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
        const url = new URL(normalized);
        vendorId = url.searchParams.get("localId") || url.searchParams.get("ref") || "";
      } catch {
        const match = raw.match(/[?&](?:localId|ref)=([^&]+)/);
        vendorId = match ? match[1] : "";
      }
    } else if (raw.startsWith("VND_")) {
      vendorId = raw.replace("VND_", "");
    } else {
      vendorId = raw;
    }

    if (!vendorId || vendorId.length < 10) {
      setScanError({ type: "invalid_qr" });
      setScanState("error");
      isScanningRef.current = false;
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.replace("/");
      return;
    }

    // Verify scanned ID is actually a vendor
    try {
      const profileSnap = await getDoc(doc(db, "entrepreneur_profiles", vendorId));
      if (!profileSnap.exists()) {
        setScanError({ type: "client_qr" });
        setScanState("error");
        isScanningRef.current = false;
        return;
      }
    } catch {
      setScanError({ type: "network" });
      setScanState("error");
      isScanningRef.current = false;
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("url_retorno", `/canje?localId=${vendorId}`);
    }
    router.replace(`/canje?localId=${vendorId}`);
  }, [router]);

  const handleRetry = useCallback(() => {
    setScanError(null);
    setScanState("idle");
    startScanner();
  }, [startScanner]);

  // ── Pantalla de espera solo cuando se necesita redirigir ──────────────────
  if (mode === "redirecting") {
    return (
      <main className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-white font-bold text-sm tracking-widest uppercase">
              Verificando acceso...
            </p>
            <p className="text-slate-500 text-xs">Club Patio · Fidelización</p>
          </div>
        </div>
      </main>
    );
  }

  // ── Escáner normal ─────────────────────────────────────────────────────────
  return (
    <main className="fixed inset-0 bg-black flex flex-col">
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

      <div className="flex-1 relative overflow-hidden">
        <div id="client-reader" className="absolute inset-0 w-full h-full" />

        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative w-64 h-64 z-10">
            <div className="absolute inset-0 border-2 border-white/20 rounded-2xl" />
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
              "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
              "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"
            ].map((cls, i) => (
              <div key={i} className={`absolute w-7 h-7 border-primary ${cls}`} />
            ))}
            <div
              className="absolute left-2 right-2 h-0.5 bg-primary/80 rounded-full shadow-[0_0_8px_2px_rgba(78,173,31,0.6)]"
              style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }}
            />
          </div>
        </div>

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

        {scanState === "error" && scanError && (
          <ErrorBanner error={scanError} onRetry={handleRetry} />
        )}
      </div>

      <div className="px-6 py-6 bg-gradient-to-t from-black to-transparent text-center space-y-1 z-10">
        <p className="text-white font-bold text-base">Apunta al código QR del mostrador</p>
        <p className="text-slate-400 text-xs">Club Patio · Sistema de fidelización</p>
      </div>

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; opacity: 0.4; }
          50% { top: 90%; opacity: 1; }
        }
        #client-reader__dashboard { display: none !important; }
        #client-reader__scan_region {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        #client-reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }
      `}</style>
    </main>
  );
}
