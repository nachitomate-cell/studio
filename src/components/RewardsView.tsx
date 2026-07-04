"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Gift, Loader2, CheckCircle2, XCircle, AlertCircle, Store,
  Clock, HelpCircle, Stamp, WifiOff, X, Star, Check, ScanLine, Lock,
} from "lucide-react";
import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, onSnapshot, Timestamp, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { canjearPremioRemoto, verificarCanjesExpirados } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { RewardsHelpModal } from "@/components/RewardsHelpModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Premio {
  id: string;
  nombre: string;
  descripcion: string;
  sellosRequeridos: number;
  icono: string;
  vendorId: string;
  vendorNombre: string;
  esSorteo: boolean;
  activo: boolean;
  stock: number;
}

interface Canje {
  id: string;
  premioNombre: string;
  premioIcono: string;
  vendorNombre: string;
  codigo: string;
  status: "pending" | "used" | "expired";
  creadoEn: Timestamp | null;
  expiraEn: string;
  sellosDescontados: number;
}

interface SuccessData {
  canjeId: string;
  codigo: string;
  premioNombre: string;
  premioIcono: string;
  vendorNombre: string;
  expiraEn: string;
}

export interface RewardsViewProps {
  user: User | null;
  userData: any;
  onShowAuth: () => void;
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(expiraEn: string | null) {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    if (!expiraEn) return;
    const tick = () => {
      const diff = new Date(expiraEn).getTime() - Date.now();
      if (diff <= 0) { setDisplay("Expirado"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiraEn]);
  return display;
}

function CountdownBadge({ expiraEn }: { expiraEn: string }) {
  const display = useCountdown(expiraEn);
  const isLow = new Date(expiraEn).getTime() - Date.now() < 3600000;
  return (
    <span className={`text-[10px] font-black tabular-nums ${isLow ? "text-amber-600" : "text-slate-400"}`}>
      Vence en {display}
    </span>
  );
}

// ─── Google Wallet (icono pequeño + texto sutil) ──────────────────────────────

function GoogleWalletMiniButton({ userId, userName, stampsCount }: {
  userId: string; userName: string; stampsCount: number;
}) {
  const [isIOS, setIsIOS] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  if (isIOS) return null;

  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/google-wallet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, userName, stampsCount }),
          });
          if (!res.ok) throw new Error();
          const { saveUrl } = await res.json();
          window.open(saveUrl, "_blank");
        } catch {
          // fallo silencioso
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="flex items-center gap-1.5 mt-3 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C14.39 3 16.57 3.91 18.22 5.42L15.5 8.14C14.56 7.27 13.34 6.75 12 6.75C9.1 6.75 6.75 9.1 6.75 12C6.75 14.9 9.1 17.25 12 17.25C14.43 17.25 16.47 15.67 17.07 13.5H12V10.5H20.93C21 11 21 11.5 21 12Z" fill="currentColor" />
        </svg>
      )}
      <span className="text-xs font-medium">{loading ? "Abriendo…" : "Guardar en Google Wallet"}</span>
    </button>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({ premio, userSellos, onConfirm, onClose, loading }: {
  premio: Premio; userSellos: number; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4" />
        <div className="px-7 pt-5 pb-8 space-y-5">
          <div className="text-center space-y-2">
            <div className="text-5xl">{premio.icono}</div>
            <h3 className="text-xl font-black text-slate-800">{premio.nombre}</h3>
            {premio.descripcion && (
              <p className="text-sm text-slate-500 font-medium">{premio.descripcion}</p>
            )}
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Local</span>
              <span className="font-bold text-slate-800">{premio.vendorNombre}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Se descontarán</span>
              <span className="font-black text-primary">{premio.sellosRequeridos} sellos</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Te quedarán</span>
              <span className="font-bold text-slate-600">{userSellos - premio.sellosRequeridos} sellos</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="w-full h-14 rounded-2xl font-black text-base gap-2 shadow-lg"
              style={{ backgroundColor: "#9DCC65" }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirmar canje</>}
            </Button>
            <Button
              onClick={onClose}
              disabled={loading}
              variant="outline"
              className="w-full h-12 rounded-2xl font-bold gap-2 text-slate-500 border-slate-200"
            >
              <XCircle className="w-4 h-4" /> Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Premio detail modal ──────────────────────────────────────────────────────

function PremioDetailModal({ premio, userSellos, onClose, onCanjear }: {
  premio: Premio; userSellos: number; onClose: () => void; onCanjear: () => void;
}) {
  const stockDisponible = typeof premio.stock !== "number" || premio.stock > 0;
  const puedeCanjear = userSellos >= premio.sellosRequeridos && stockDisponible;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />
        <div className="px-7 pt-5 pb-4 flex justify-between items-start shrink-0">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-sm ${premio.esSorteo ? "bg-yellow-400" : "bg-primary/10"}`}>
            {premio.icono || "🎁"}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="px-7 overflow-y-auto space-y-6 flex-1 pb-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 leading-tight">{premio.nombre}</h2>
            <p className="text-sm text-primary font-bold">{premio.sellosRequeridos} sellos requeridos</p>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Descripción</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              {premio.descripcion || "Este premio no tiene una descripción detallada, pero te aseguramos que es genial."}
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dónde canjearlo</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                <Store className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-slate-800">{premio.vendorNombre || "Patio Curauma"}</p>
                <p className="text-xs text-slate-500">Local Adherido</p>
              </div>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
              <p>Para canjearlo, debes dirigirte a <strong>{premio.vendorNombre || "la administración"}</strong> y mostrar el código que se generará al confirmar el canje.</p>
            </div>
          </div>
        </div>
        <div className="px-7 py-5 shrink-0 border-t border-slate-100 bg-white">
          {puedeCanjear ? (
            <Button
              onClick={onCanjear}
              className="w-full h-14 rounded-2xl font-black text-base shadow-lg hover:opacity-90"
              style={{ backgroundColor: premio.esSorteo ? "#EAB308" : "#9DCC65", color: "white" }}
            >
              Canjear Premio
            </Button>
          ) : userSellos < premio.sellosRequeridos ? (
            <div className="w-full p-4 rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-center border border-slate-200">
              <p className="text-sm font-bold text-slate-500">Te faltan {premio.sellosRequeridos - userSellos} sellos</p>
              <p className="text-xs text-slate-400">Sigue comprando para acumular más sellos.</p>
            </div>
          ) : (
            <div className="w-full p-4 rounded-2xl bg-red-50 flex flex-col items-center justify-center text-center border border-red-100">
              <p className="text-sm font-bold text-red-400">Sin stock disponible</p>
              <p className="text-xs text-red-300">Este premio se agotó por el momento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ data, onVerMisCanjes }: { data: SuccessData; onVerMisCanjes: () => void }) {
  const countdown = useCountdown(data.expiraEn);
  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-6 text-white overflow-hidden"
      style={{ background: "linear-gradient(135deg, #9DCC65 0%, #6EBBD1 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/15"
            style={{
              width: `${150 + i * 80}px`, height: `${150 + i * 80}px`,
              top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              animation: `ping ${1.6 + i * 0.4}s cubic-bezier(0,0,0.2,1) infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-6 text-center">
        <div className="text-7xl drop-shadow-xl animate-bounce" style={{ animationDuration: "1.2s" }}>
          {data.premioIcono}
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-black drop-shadow-lg">¡Premio canjeado!</h1>
          <p className="text-white/85 font-semibold text-lg">{data.premioNombre}</p>
          <p className="text-white/65 text-sm font-medium">{data.vendorNombre}</p>
        </div>
        <div className="w-full bg-white/15 backdrop-blur-xl rounded-3xl border border-white/25 shadow-2xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-3">Muestra este QR al vendedor</p>
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-white rounded-2xl shadow-lg">
                <QRCode value={`canje:${data.canjeId}`} size={140} fgColor="#1e293b" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-[0.15em] drop-shadow">{data.codigo}</p>
          </div>
          <div className="h-px bg-white/15" />
          <div className="flex items-center justify-center gap-2 text-white/70">
            <Clock className="w-4 h-4 shrink-0" />
            <p className="text-xs font-bold">
              {countdown ? `Vence en ${countdown}` : "Válido por 48 horas"} · Muéstralo en {data.vendorNombre}
            </p>
          </div>
        </div>
        <button
          onClick={onVerMisCanjes}
          className="w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-xl active:scale-[0.97] transition-transform"
          style={{ backgroundColor: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)" }}
        >
          Ver mis canjes activos
        </button>
      </div>
    </div>
  );
}

// ─── RewardsView (componente principal unificado) ─────────────────────────────

export function RewardsView({ user, userData, onShowAuth }: RewardsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const misCanjesRef = useRef<HTMLDivElement>(null);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showStampAnim, setShowStampAnim] = useState(false);
  const [shakeBac, setShakeBac] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof window !== "undefined" ? !navigator.onLine : false
  );
  const prevSellosRef = useRef<number | null>(null);

  const [premios, setPremios] = useState<Premio[]>([]);
  const [premiosLoading, setPremiosLoading] = useState(true);
  const [myCanjes, setMyCanjes] = useState<Canje[]>([]);
  const [canjesLoading, setCanjesLoading] = useState(true);

  const [selectedPremio, setSelectedPremio] = useState<Premio | null>(null);
  const [confirmPremio, setConfirmPremio] = useState<Premio | null>(null);
  const [canjeando, setCanjeando] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [vendorStampState, setVendorStampState] = useState<{
    docId: string;
    vendorName: string;
    status: "vendor_processing" | "vendor_confirmed";
  } | null>(null);

  const cachedData = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("cached_stamp_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sellos: number = userData?.comprasRealizadas ?? cachedData?.sellos ?? 0;
  const userName: string = userData?.nombre ?? cachedData?.nombre ?? "Miembro";
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);

  // Offline detection
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Cache to localStorage
  const comprasRealizadas = userData?.comprasRealizadas;
  const ticketsSorteo = userData?.ticketsSorteo;
  const nombreUsuario = userData?.nombre;
  useEffect(() => {
    if (!isOffline && userData) {
      localStorage.setItem("cached_stamp_data", JSON.stringify({
        sellos: comprasRealizadas || 0,
        tickets: ticketsSorteo || 0,
        nombre: nombreUsuario || "Miembro",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, comprasRealizadas, ticketsSorteo, nombreUsuario]);

  // Stamp animation on sello gain
  useEffect(() => {
    if (prevSellosRef.current !== null && sellosEnTarjeta > prevSellosRef.current) {
      setShowStampAnim(true);
      const t = setTimeout(() => setShowStampAnim(false), 1600);
      prevSellosRef.current = sellosEnTarjeta;
      return () => clearTimeout(t);
    }
    prevSellosRef.current = sellosEnTarjeta;
  }, [sellosEnTarjeta]);

  // Load premios
  useEffect(() => {
    const q = query(collection(db, "premios"), where("activo", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const list: Premio[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Premio))
        .sort((a, b) => a.sellosRequeridos - b.sellosRequeridos);
      setPremios(list);
      setPremiosLoading(false);
    });
    return () => unsub();
  }, []);

  // Load canjes
  useEffect(() => {
    if (!user) return;
    verificarCanjesExpirados(db, user.uid).catch(() => {});
    const q = query(collection(db, "canjes"), where("clienteId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: Canje[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Canje))
        .sort((a, b) => (b.creadoEn?.toMillis?.() ?? 0) - (a.creadoEn?.toMillis?.() ?? 0));
      setMyCanjes(list);
      setCanjesLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Vendor-initiated stamp listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "pending_stamps"),
      where("userId", "==", user.uid),
      where("initiatedBy", "==", "vendor"),
      where("status", "in", ["vendor_processing", "vendor_confirmed"])
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setVendorStampState(null);
        return;
      }
      const d = snap.docs[0];
      const data = d.data();
      setVendorStampState({
        docId: d.id,
        vendorName: data.vendorName || "el local",
        status: data.status,
      });
      // Auto-dismiss after confirmed
      if (data.status === "vendor_confirmed") {
        setTimeout(() => {
          deleteDoc(doc(db, "pending_stamps", d.id)).catch(() => {});
          setVendorStampState(null);
        }, 4000);
      }
    });
    return () => unsub();
  }, [user]);

  // Prize redemption
  const handleConfirmar = async () => {
    if (!confirmPremio || !user) return;
    setCanjeando(true);
    try {
      const { canjeId, codigo } = await canjearPremioRemoto(confirmPremio.id);
      const expiraEn = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      setSuccessData({
        canjeId: canjeId ?? "",
        codigo: codigo ?? "",
        premioNombre: confirmPremio.nombre,
        premioIcono: confirmPremio.icono,
        vendorNombre: confirmPremio.vendorNombre,
        expiraEn,
      });
      setConfirmPremio(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al canjear", description: err?.message || "Inténtalo de nuevo." });
    } finally {
      setCanjeando(false);
    }
  };

  const scrollToCanjes = () => {
    setSuccessData(null);
    setTimeout(() => misCanjesRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Computed prize availability
  const premiosReqs = premios.map((p) => p.sellosRequeridos);
  const proximoPremioReq = premiosReqs.find((r) => r > sellos) ?? null;
  const tienePremioDisponible = premiosReqs.some((r) => r <= sellos);
  const sellosRestantesParaPremio = proximoPremioReq !== null ? proximoPremioReq - sellos : null;
  // La tarjeta muestra SIEMPRE el conteo real de sellos. La disponibilidad de
  // premio se comunica aparte (badge "premio listo"), sin falsear el progreso.
  const sellosDisplay = sellosEnTarjeta;

  const pendingCanjes = myCanjes.filter((c) => c.status === "pending");
  const pastCanjes = myCanjes.filter((c) => c.status !== "pending");

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="pt-6 px-4 bg-white min-h-[60vh] flex flex-col items-center justify-center">
        <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 w-full max-w-xs text-center space-y-4">
          <div className="text-5xl">🎁</div>
          <h2 className="text-xl font-black text-primary">Descubre tus Beneficios</h2>
          <p className="text-sm text-muted-foreground">
            Únete al club para acumular sellos y canjear premios exclusivos en todos nuestros locales.
          </p>
          <Button onClick={onShowAuth} className="w-full rounded-2xl h-14 text-lg font-bold">
            Unirme al Club
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 px-4 bg-white pb-24 space-y-5 animate-in fade-in duration-300">
      <RewardsHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      {/* Vendor-initiated stamp overlay */}
      {vendorStampState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl p-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
            {vendorStampState.status === "vendor_processing" ? (
              <>
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: "rgba(211,182,115,0.15)" }}>
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#D3B673" }} />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-black text-slate-800">Procesando tu sello...</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    <span className="font-bold" style={{ color: "#D3B673" }}>{vendorStampState.vendorName}</span>{" "}
                    está registrando el monto de tu compra. Espera un momento.
                  </p>
                </div>
                <button
                  onClick={() => {
                    deleteDoc(doc(db, "pending_stamps", vendorStampState.docId)).catch(() => {});
                    setVendorStampState(null);
                  }}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mx-auto"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar transacción
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-black text-emerald-800">¡Sello recibido! ⭐</p>
                  <p className="text-sm text-slate-500">
                    Tu compra en{" "}
                    <span className="font-bold" style={{ color: "#D3B673" }}>{vendorStampState.vendorName}</span>{" "}
                    quedó registrada.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Offline banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50"
          >
            <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs font-bold text-amber-800 leading-snug">
              Modo consulta: Conéctate para actualizar tus puntos.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mi Tarjeta de Sellos ──────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="font-headline font-semibold text-base text-primary flex items-center gap-2 px-1">
          <Star className="w-4 h-4 fill-[#C9920A] text-[#C9920A]" /> Mi Tarjeta de Sellos
        </h3>
        <div
          className="rounded-[2rem] overflow-hidden relative shadow-2xl"
          style={{ background: "linear-gradient(145deg, #1C1408 0%, #2E1D08 55%, #1A1206 100%)" }}
        >
          {/* Patrón diagonal sutil */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(45deg, rgba(201,146,10,0.035) 0px, rgba(201,146,10,0.035) 1px, transparent 1px, transparent 22px)",
          }} />
          {/* Logo marca de agua */}
          <div aria-hidden style={{
            position: "absolute", bottom: -10, right: -10,
            width: 140, height: 140, opacity: 0.055, pointerEvents: "none",
          }}>
            <Image src="/Logo3.webp" alt="" fill className="object-contain" />
          </div>

          {/* Stamp animation overlay */}
          <AnimatePresence>
            {showStampAnim && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 0.35, 0] }}
                  transition={{ duration: 1.2, times: [0, 0.25, 1] }}
                  className="absolute inset-0 z-10 pointer-events-none rounded-[2rem]"
                  style={{ backgroundColor: "#C9920A" }}
                />
                <motion.div
                  initial={{ scale: 3, rotate: -40, opacity: 0, y: -60 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1, y: 0 }}
                  exit={{ scale: 0.6, opacity: 0, y: 30 }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                  className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                >
                  <div className="rounded-full p-5 shadow-2xl" style={{ background: "linear-gradient(135deg, #C9920A, #E8C547)" }}>
                    <Stamp className="w-14 h-14 text-white" />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="p-6 relative z-10">
            {/* Header de la tarjeta */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p style={{ fontSize: 9, letterSpacing: "3.5px", color: "#C9920A", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
                  Club Patio Curauma
                </p>
                <p style={{ fontSize: 17, fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.3px", lineHeight: 1 }}>
                  Tarjeta de Fidelidad
                </p>
              </div>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "linear-gradient(135deg, #C9920A 0%, #E8C547 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 14px rgba(201,146,10,0.5)",
                flexShrink: 0,
              }}>
                <Star className="w-5 h-5 text-white fill-white" />
              </div>
            </div>

            {/* Grid de sellos */}
            <div className="grid grid-cols-5 gap-2.5 mb-5">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < sellosDisplay;
                return (
                  <div
                    key={i}
                    className="relative"
                    style={{ aspectRatio: "1" }}
                  >
                    {filled ? (
                      <motion.div
                        initial={false}
                        animate={{ scale: [1, 1.12, 1] }}
                        style={{
                          width: "100%", height: "100%", borderRadius: "50%",
                          background: "linear-gradient(135deg, #FFF8E8 0%, #FFFDF5 100%)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 3px 10px rgba(201,146,10,0.55)",
                          border: "2px solid #C9920A",
                          position: "relative", overflow: "hidden",
                          padding: 4,
                        }}
                      >
                        <Image src="/Logo2.png" alt="Sello" fill sizes="10vw" className="object-contain" style={{ padding: 4 }} />
                      </motion.div>
                    ) : (
                      <div style={{
                        width: "100%", height: "100%", borderRadius: "50%",
                        background: "rgba(255,255,255,0.05)",
                        border: "1.5px solid rgba(201,146,10,0.22)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Contador + barra */}
            <div className="mb-5">
              <div className="flex items-baseline justify-between mb-2">
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>
                  Progreso
                </span>
                <span>
                  <span style={{ color: "#E8C547", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{sellosDisplay}</span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 600 }}> / 10</span>
                  {sellos > 10 && (
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginLeft: 4 }}>({sellos} total)</span>
                  )}
                </span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(sellosDisplay / 10) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    background: "linear-gradient(90deg, #C9920A, #E8C547)",
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>

            {/* Mensaje de estado */}
            <div className="space-y-3">
              <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {sellos === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>
                    Escanea tu primer QR para comenzar
                  </p>
                ) : tienePremioDisponible ? (
                  <p style={{ color: "#E8C547", fontSize: 13, fontWeight: 800 }}>
                    🎁 ¡Tienes un premio listo para canjear!
                  </p>
                ) : sellosRestantesParaPremio !== null ? (
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 600 }}>
                    Te faltan <span style={{ color: "#E8C547", fontWeight: 900 }}>{sellosRestantesParaPremio} sellos</span> para tu próximo premio
                  </p>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>
                    ¡Sigue acumulando sellos!
                  </p>
                )}
              </div>

              <button
                className="w-full h-11 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg, #C9920A 0%, #E8C547 100%)", color: "#1C1408", fontSize: 13, fontWeight: 800, boxShadow: "0 4px 16px rgba(201,146,10,0.45)" }}
                onClick={() => router.push("/scan")}
              >
                <ScanLine className="w-4 h-4" />
                Escanear QR
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ruta Curauma ─────────────────────────────────────────────────────── */}
      <Card
        onClick={() => router.push("/ruta")}
        className="cursor-pointer shadow-md rounded-3xl overflow-hidden transition-all active:scale-[0.98] border border-[#E6196E]/40 hover:border-[#E6196E]"
        style={{
          background: "radial-gradient(circle at top right, rgba(230,25,110,0.18) 0%, #0F172A 60%)",
          boxShadow: "0 0 24px rgba(230,25,110,0.15), 0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 shadow-md">
            <Image
              alt="Logo Ruta Curauma"
              className="object-cover w-full h-full"
              height={40}
              src="/curauma/logo-ruta-curauma.png"
              width={40}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Explora el patio</p>
            <h3 className="text-xl font-black text-white">Ruta Curauma</h3>
            <p className="text-xs text-white/70 mt-1">
              Colecciona estampillas visitando todos los locales aliados.
            </p>
          </div>
          <span className="text-2xl font-light text-[#E6196E]/70">›</span>
        </CardContent>
      </Card>

      {/* ── Ruta BAC · Teaser (bloqueado) ────────────────────────────────────── */}
      <motion.div
        onClick={() => {
          setShakeBac(true);
          toast({
            title: "🍷 ¡La Ruta BAC abre muy pronto!",
            description: "Prepárate para recorrer los 26 locales adheridos en Cerro Alegre y Concepción.",
          });
          setTimeout(() => setShakeBac(false), 500);
        }}
        animate={shakeBac ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden select-none cursor-pointer rounded-3xl border border-[#FF4B91]/40 shadow-lg p-4 md:p-5 flex items-center gap-4 active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(135deg, #1a2b5c 0%, #0f1a3d 100%)",
          boxShadow: "0 0 24px rgba(255,75,145,0.18), 0 6px 18px rgba(0,0,0,0.35)",
        }}
        role="button"
        aria-label="Ruta BAC · Tapas & Copas V.02 (próximamente)"
      >
        {/* Decorative glow */}
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,75,145,0.20) 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-[#24346c] p-1.5 flex items-center justify-center border border-white/10 shrink-0 relative">
          <Image
            src="/bac/logo-tapas-copas.png"
            alt="Ruta BAC · Tapas & Copas"
            width={40}
            height={40}
            className="object-contain w-full h-full"
          />
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0 relative">
          <span className="bg-[#FF4B91]/20 text-[#FF4B91] font-bold text-[10px] px-2 py-0.5 rounded-full inline-block mb-1 tracking-wider">
            🔒 PRÓXIMAMENTE
          </span>
          <h3 className="text-white font-black text-base md:text-lg tracking-wide leading-tight">
            Ruta BAC · Tapas &amp; Copas V.02
          </h3>
          <p className="text-slate-300 text-xs md:text-sm mt-0.5 leading-snug">
            Recorre Cerro Alegre y Concepción. Desbloquea tu pasaporte pronto.
          </p>
        </div>

        {/* Lock indicator */}
        <div className="shrink-0 relative flex flex-col items-center gap-1">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10"
            style={{ background: "rgba(253,241,214,0.08)" }}
          >
            <Lock className="w-4 h-4" style={{ color: "#FDF1D6" }} />
          </div>
        </div>
      </motion.div>

      {/* ── Catálogo de Beneficios ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" /> Catálogo de Beneficios
        </h2>

        {premiosLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#D3B673" }} />
          </div>
        ) : premios.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 font-medium">
            No hay premios disponibles por ahora.
          </div>
        ) : (
          <div className="space-y-5">
            {(() => {
              const grupos: Record<string, { vendorName: string; items: Premio[] }> = {};
              premios.forEach((premio) => {
                const key = premio.vendorId || "__general__";
                const vendorName = premio.vendorNombre || "Patio Curauma";
                if (!grupos[key]) grupos[key] = { vendorName, items: [] };
                grupos[key].items.push(premio);
              });

              return Object.entries(grupos).map(([vendorKey, grupo]) => (
                <div key={vendorKey} className="space-y-2">
                  {/* Encabezado del local */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-primary truncate">
                      {grupo.vendorName}
                    </p>
                    <div className="flex-1 h-px bg-primary/15" />
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                      {grupo.items.length} {grupo.items.length === 1 ? "premio" : "premios"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {grupo.items.map((premio) => {
                      const stockDisponible = typeof premio.stock !== "number" || premio.stock > 0;
                      const puedeCanjear = sellos >= premio.sellosRequeridos && stockDisponible;
                      return (
                        <Card
                          key={premio.id}
                          onClick={() => setSelectedPremio(premio)}
                          className={`border overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200 ${
                            premio.esSorteo
                              ? "border-yellow-200 bg-yellow-50/30"
                              : puedeCanjear
                              ? "border-primary/20 shadow-sm hover:shadow-md hover:border-primary/40"
                              : "border-slate-100 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl ${premio.esSorteo ? "bg-yellow-400" : "bg-primary/10"}`}>
                              {premio.icono || "🎁"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-slate-800 leading-tight">{premio.nombre}</p>
                              <p className="text-[11px] font-black text-primary mt-0.5">{premio.sellosRequeridos} sellos</p>
                            </div>
                            {puedeCanjear ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedPremio(premio); }}
                                className="shrink-0 px-4 py-2 rounded-2xl font-black text-xs text-white shadow-md active:scale-95 transition-transform"
                                style={{ backgroundColor: premio.esSorteo ? "#EAB308" : "#C9920A" }}
                              >
                                ¡Canjear ahora!
                              </button>
                            ) : sellos < premio.sellosRequeridos ? (
                              <span className="shrink-0 px-3 py-2 rounded-2xl text-xs font-bold bg-gray-100 text-gray-500">
                                Faltan {premio.sellosRequeridos - sellos}
                              </span>
                            ) : (
                              <span className="shrink-0 px-3 py-2 rounded-2xl text-xs font-bold bg-red-50 text-red-400">
                                Sin stock
                              </span>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </section>

      {/* ── Mis Canjes Activos ────────────────────────────────────────────────── */}
      <section className="space-y-3" ref={misCanjesRef}>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mis Canjes Activos
        </h2>

        {canjesLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#D3B673" }} />
          </div>
        ) : pendingCanjes.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 py-10 text-center space-y-2">
            <Gift className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-400 font-medium">No tienes canjes activos</p>
            <p className="text-xs text-slate-300">Cuando canjees un premio aparecerá aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingCanjes.map((canje) => (
              <Card key={canje.id} className="border border-emerald-100 bg-white shadow-sm rounded-3xl overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl shrink-0">
                      {canje.premioIcono || "🎁"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-slate-800 truncate">{canje.premioNombre}</p>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          PENDIENTE
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{canje.vendorNombre}</p>
                      <CountdownBadge expiraEn={canje.expiraEn} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t border-emerald-50">
                    <div className="p-2 bg-white border border-slate-100 rounded-xl shadow-sm shrink-0">
                      <QRCode value={`canje:${canje.id}`} size={80} fgColor="#1e293b" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mb-1">Muéstralo al vendedor</p>
                      <p className="text-lg font-black tracking-widest text-primary">{canje.codigo}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {pastCanjes.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-1">Historial</p>
            {pastCanjes.slice(0, 5).map((canje) => (
              <div key={canje.id} className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100">
                <span className="text-lg">{canje.premioIcono || "🎁"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-600 truncate">{canje.premioNombre}</p>
                  <p className="text-[10px] text-slate-400">{canje.codigo}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                  canje.status === "used" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {canje.status === "used" ? "USADO" : "EXPIRADO"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── QR Code Central ──────────────────────────────────────────────────── */}
      <Card
        className="border-none shadow-xl rounded-[2rem] overflow-hidden"
        style={{ background: "linear-gradient(135deg, #F7F9F0 0%, #EEF5E8 100%)", borderLeft: "3px solid var(--color-secondary)" }}
      >
        <CardContent className="flex flex-col items-center py-7 px-6">
          <div className="flex items-center justify-between w-full mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tu código QR</p>
              <p className="text-sm font-bold text-slate-700">{userName}</p>
            </div>
            <button
              onClick={() => setShowHelpModal(true)}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"
              aria-label="¿Cómo funciona?"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 bg-white border-2 border-primary/5 rounded-3xl shadow-inner flex items-center justify-center">
            <QRCode
              value={user.uid}
              size={180}
              fgColor="#000000"
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>
          <p className="text-xs text-slate-400 font-medium mt-3">Muestra este código en caja para sumar sellos</p>
          <GoogleWalletMiniButton userId={user.uid} userName={userName} stampsCount={sellos} />
        </CardContent>
      </Card>

      {/* Modales */}
      {selectedPremio && !confirmPremio && (
        <PremioDetailModal
          premio={selectedPremio}
          userSellos={sellos}
          onClose={() => setSelectedPremio(null)}
          onCanjear={() => setConfirmPremio(selectedPremio)}
        />
      )}
      {confirmPremio && (
        <ConfirmModal
          premio={confirmPremio}
          userSellos={sellos}
          onConfirm={handleConfirmar}
          onClose={() => setConfirmPremio(null)}
          loading={canjeando}
        />
      )}
      {successData && (
        <SuccessScreen data={successData} onVerMisCanjes={scrollToCanjes} />
      )}
    </div>
  );
}
