"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, Timestamp, doc,
} from "firebase/firestore";
import { canjearPremio, verificarCanjesExpirados } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Clock, Gift, Loader2, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Countdown ────────────────────────────────────────────────────────────────

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
      if (h > 0) setDisplay(`${h}h ${m}m`);
      else setDisplay(`${m}m ${s}s`);
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
    <span
      className={`text-[10px] font-black tabular-nums ${isLow ? "text-amber-600" : "text-slate-400"}`}
    >
      Vence en {display}
    </span>
  );
}

// ─── Modal de confirmación ────────────────────────────────────────────────────

function ConfirmModal({
  premio,
  userSellos,
  onConfirm,
  onClose,
  loading,
}: {
  premio: Premio;
  userSellos: number;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
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
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Confirmar canje</>
              )}
            </Button>
            <Button
              onClick={onClose}
              disabled={loading}
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
  );
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

function SuccessScreen({
  data,
  onVerMisCanjes,
}: {
  data: SuccessData;
  onVerMisCanjes: () => void;
}) {
  const countdown = useCountdown(data.expiraEn);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-6 text-white overflow-hidden"
      style={{ background: "linear-gradient(135deg, #9DCC65 0%, #6EBBD1 100%)" }}
    >
      {/* Anillos animados */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/15"
            style={{
              width: `${150 + i * 80}px`,
              height: `${150 + i * 80}px`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: `ping ${1.6 + i * 0.4}s cubic-bezier(0,0,0.2,1) infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-6 text-center">
        {/* Ícono */}
        <div className="text-7xl drop-shadow-xl animate-bounce" style={{ animationDuration: "1.2s" }}>
          {data.premioIcono}
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-black drop-shadow-lg">¡Premio canjeado!</h1>
          <p className="text-white/85 font-semibold text-lg">{data.premioNombre}</p>
          <p className="text-white/65 text-sm font-medium">{data.vendorNombre}</p>
        </div>

        {/* Código */}
        <div className="w-full bg-white/15 backdrop-blur-xl rounded-3xl border border-white/25 shadow-2xl p-6 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">
              Tu código único
            </p>
            <p className="text-4xl font-black tracking-[0.15em] drop-shadow">{data.codigo}</p>
          </div>
          <div className="h-px bg-white/15" />
          <div className="flex items-center justify-center gap-2 text-white/70">
            <Clock className="w-4 h-4 shrink-0" />
            <p className="text-xs font-bold">
              {countdown ? `Vence en ${countdown}` : "Válido por 48 horas"} · Muéstralo en {data.vendorNombre}
            </p>
          </div>
        </div>

        {/* Botón */}
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PremiosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const misCanjesRef = useRef<HTMLDivElement>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userSellos, setUserSellos] = useState(0);

  const [premios, setPremios] = useState<Premio[]>([]);
  const [premiosLoading, setPremiosLoading] = useState(true);

  const [myCanjes, setMyCanjes] = useState<Canje[]>([]);
  const [canjesLoading, setCanjesLoading] = useState(true);

  const [confirmPremio, setConfirmPremio] = useState<Premio | null>(null);
  const [canjeando, setCanjeando] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // ── Auth + datos del usuario ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("url_retorno", "/premios");
        }
        router.push("/?login=true");
        return;
      }
      setUserId(user.uid);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Escuchar sellos del usuario en tiempo real ───────────────────────────
  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, "usuarios", userId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setUserSellos(snap.data().comprasRealizadas || 0);
    });
    return () => unsub();
  }, [userId]);

  // ── Cargar premios activos ───────────────────────────────────────────────
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

  // ── Canjes del usuario (onSnapshot) + verificar expirados ───────────────
  useEffect(() => {
    if (!userId) return;

    // Verificar expirados en background
    verificarCanjesExpirados(db, userId).catch(() => {});

    const q = query(collection(db, "canjes"), where("clienteId", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      const list: Canje[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Canje))
        .sort((a, b) => {
          const ta = a.creadoEn?.toMillis?.() ?? 0;
          const tb = b.creadoEn?.toMillis?.() ?? 0;
          return tb - ta;
        });
      setMyCanjes(list);
      setCanjesLoading(false);
    });
    return () => unsub();
  }, [userId]);

  // ── Confirmar canje ──────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    if (!confirmPremio || !userId) return;
    setCanjeando(true);
    try {
      const userName = auth.currentUser?.displayName || "";
      const { canjeId, codigo } = await canjearPremio(db, userId, userName, {
        id: confirmPremio.id,
        nombre: confirmPremio.nombre,
        icono: confirmPremio.icono,
        vendorId: confirmPremio.vendorId,
        vendorNombre: confirmPremio.vendorNombre,
        sellosRequeridos: confirmPremio.sellosRequeridos,
      });
      const expiraEn = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      setSuccessData({
        canjeId,
        codigo,
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }

  const pendingCanjes = myCanjes.filter((c) => c.status === "pending");
  const pastCanjes = myCanjes.filter((c) => c.status !== "pending");

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            className="text-slate-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-800">Catálogo de Premios</h1>
            <p className="text-xs text-slate-400 font-medium">
              {userSellos} sello{userSellos !== 1 ? "s" : ""} disponibles
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-2xl font-black text-sm"
            style={{ backgroundColor: "rgba(211,182,115,0.12)", color: "#D3B673" }}
          >
            {userSellos} ⭐
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-8">

        {/* ── Catálogo ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" /> Beneficios disponibles
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
            <div className="grid grid-cols-1 gap-3">
              {premios.map((premio) => {
                const puedeCanjear = userSellos >= premio.sellosRequeridos;
                return (
                  <Card
                    key={premio.id}
                    className={`border overflow-hidden transition-all duration-200 ${
                      premio.esSorteo
                        ? "border-yellow-200 bg-yellow-50/30"
                        : puedeCanjear
                        ? "border-primary/20 shadow-md"
                        : "border-slate-100 opacity-80"
                    }`}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      {/* Ícono */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl ${
                          premio.esSorteo ? "bg-yellow-400" : "bg-primary/10"
                        }`}
                      >
                        {premio.icono || "🎁"}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 leading-tight">{premio.nombre}</p>
                        {premio.descripcion && (
                          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{premio.descripcion}</p>
                        )}
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                          {premio.vendorNombre || "Patio Curauma"}
                        </p>
                        <p className="text-[11px] font-black text-primary mt-0.5">
                          {premio.sellosRequeridos} sellos
                        </p>
                      </div>

                      {/* Acción */}
                      {puedeCanjear ? (
                        <button
                          onClick={() => setConfirmPremio(premio)}
                          className="shrink-0 px-4 py-2 rounded-2xl font-black text-xs text-white shadow-md active:scale-95 transition-transform"
                          style={{ backgroundColor: premio.esSorteo ? "#EAB308" : "#9DCC65" }}
                        >
                          🎁 Canjear
                        </button>
                      ) : (
                        <span
                          className="shrink-0 px-3 py-2 rounded-2xl text-xs font-bold"
                          style={{ backgroundColor: "rgba(201,146,10,0.10)", color: "#C9920A" }}
                        >
                          Faltan {premio.sellosRequeridos - userSellos}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Mis Canjes Activos ───────────────────────────────────────── */}
        <section className="space-y-3" ref={misCanjesRef}>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mis Canjes Activos
          </h2>

          {canjesLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#D3B673" }} />
            </div>
          ) : pendingCanjes.length === 0 ? (
            <div
              className="rounded-3xl border-2 border-dashed border-slate-200 py-10 text-center space-y-2"
            >
              <Gift className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-400 font-medium">No tienes canjes activos</p>
              <p className="text-xs text-slate-300">Cuando canjees un premio aparecerá aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingCanjes.map((canje) => (
                <Card key={canje.id} className="border border-emerald-100 bg-white shadow-sm rounded-3xl overflow-hidden">
                  {/* Barra de color superior */}
                  <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
                  <CardContent className="p-4">
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
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black tracking-widest text-primary">{canje.codigo}</p>
                        <p className="text-[9px] text-slate-400 font-medium uppercase">Muéstralo en caja</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Historial de canjes pasados */}
          {pastCanjes.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-1">Historial</p>
              {pastCanjes.slice(0, 5).map((canje) => (
                <div
                  key={canje.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100"
                >
                  <span className="text-lg">{canje.premioIcono || "🎁"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-600 truncate">{canje.premioNombre}</p>
                    <p className="text-[10px] text-slate-400">{canje.codigo}</p>
                  </div>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      canje.status === "used"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {canje.status === "used" ? "USADO" : "EXPIRADO"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modales */}
      {confirmPremio && (
        <ConfirmModal
          premio={confirmPremio}
          userSellos={userSellos}
          onConfirm={handleConfirmar}
          onClose={() => setConfirmPremio(null)}
          loading={canjeando}
        />
      )}

      {successData && (
        <SuccessScreen data={successData} onVerMisCanjes={scrollToCanjes} />
      )}
    </main>
  );
}
