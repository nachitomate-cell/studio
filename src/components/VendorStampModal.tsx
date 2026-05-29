"use client";

import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, where, Timestamp, and } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, User, X } from "lucide-react";

interface PendingClientStamp {
  id: string;
  userId: string;
  userName: string;
  createdAt: Timestamp | null;
}

export default function VendorStampModal({ vendorId }: { vendorId: string | null }) {
  const { toast } = useToast();
  const [pendingStamps, setPendingStamps] = useState<PendingClientStamp[]>([]);
  const [confirmingStamp, setConfirmingStamp] = useState<PendingClientStamp | null>(null);
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(false);
  const autoOpenedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!vendorId) return;
    const q = query(
      collection(db, "pending_stamps"),
      where("vendorId", "==", vendorId),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const stamps: PendingClientStamp[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const createdAt: Timestamp | null = data.createdAt ?? null;
        if (!createdAt) return;
        if ((now - createdAt.toDate().getTime()) / 1000 > 5 * 60) return;
        stamps.push({ id: d.id, userId: data.userId, userName: data.userName, createdAt });
      });
      setPendingStamps(stamps);
    });
    return () => unsub();
  }, [vendorId]);

  useEffect(() => {
    if (confirmingStamp || pendingStamps.length === 0) return;
    const next = pendingStamps.find(s => !autoOpenedRef.current.has(s.id));
    if (!next) return;
    autoOpenedRef.current.add(next.id);
    setConfirmingStamp(next);
    setMonto("");
  }, [pendingStamps, confirmingStamp]);

  const handleConfirm = async () => {
    if (!confirmingStamp) return;
    const montoNum = parseInt(monto.replace(/\D/g, ""), 10) || 0;
    if (montoNum <= 0 || montoNum > 150_000) {
      toast({ variant: "destructive", title: "Monto inválido", description: "Ingresa un monto entre $1 y $150.000." });
      return;
    }
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión");
      const res = await fetch("/api/handshake/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ pendingId: confirmingStamp.id, monto: montoNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al confirmar");
      toast({ title: "✅ Sello confirmado", description: `Sello acreditado a ${confirmingStamp.userName}.` });
      setConfirmingStamp(null);
      setMonto("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo confirmar." });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirmingStamp) return;
    setLoading(true);
    try {
      const stampRef = doc(db, "pending_stamps", confirmingStamp.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(stampRef);
        if (!snap.exists()) throw new Error("not_found");
        const status = snap.data()?.status;
        if (status !== "pending") throw new Error("already_processed");
        tx.update(stampRef, { status: "rejected" });
      });
      toast({ title: "Solicitud rechazada" });
      setConfirmingStamp(null);
      setMonto("");
    } catch (err: any) {
      if (err?.message === "already_processed") {
        toast({ title: "Solicitud ya procesada", description: "Esta solicitud ya fue confirmada o expiró." });
        setConfirmingStamp(null);
        setMonto("");
      } else {
        toast({ variant: "destructive", title: "Error al rechazar", description: "No se pudo rechazar la solicitud. Intenta de nuevo." });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!vendorId) return null;

  return (
    <>
      {confirmingStamp && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { setConfirmingStamp(null); setMonto(""); }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4" />
            <div className="px-7 pt-5 pb-8 space-y-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(211,182,115,0.15)", color: "#D3B673" }}
                >
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cliente en mostrador</p>
                  <h3 className="text-xl font-black text-slate-800">{confirmingStamp.userName}</h3>
                </div>
              </div>

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
                    onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                    disabled={loading}
                    autoFocus
                    className="w-full h-14 pl-8 pr-4 rounded-2xl border-2 border-slate-200 focus:border-primary focus:outline-none text-lg font-black text-slate-800 bg-slate-50 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Máximo $150.000.</p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleConfirm}
                  disabled={loading || !monto}
                  className="w-full h-14 rounded-2xl font-black text-base gap-2 shadow-lg"
                  style={{ backgroundColor: "#D3B673" }}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <><CheckCircle2 className="w-5 h-5" />Confirmar sello (+1 ⭐)</>
                  )}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold gap-2 text-slate-500 border-slate-200"
                >
                  <X className="w-4 h-4" />
                  Rechazar solicitud
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingStamps.length > 0 && !confirmingStamp && (
        <button
          onClick={() => {
            const next = pendingStamps[0];
            autoOpenedRef.current.add(next.id);
            setConfirmingStamp(next);
            setMonto("");
          }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-2xl animate-bounce"
          style={{ background: "#D3B673", color: "white" }}
        >
          <User className="w-4 h-4 shrink-0" />
          <span className="font-black text-sm whitespace-nowrap">
            {pendingStamps[0].userName} espera sello
          </span>
          <span className="bg-white/25 text-white text-xs font-black px-2 py-0.5 rounded-full">
            Validar
          </span>
        </button>
      )}
    </>
  );
}
