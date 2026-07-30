"use client";

/**
 * Panel de sorteos por campaña. Pensado para operarse en vivo, desde el teléfono,
 * en medio de un evento — por eso todo está en una pantalla y sin pasos ocultos.
 *
 * Flujo: se elige la campaña (los socios se marcan al inscribirse desde el QR del
 * evento), se ve quiénes participan, se puede avisarles a todos, y al final se
 * extrae un ganador y se le notifica por bandeja, push y correo.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { canAccessModPanel, CANONICAL_BASE_URL } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Loader2, Trophy, Users, Mail, Bell, Send, RefreshCw, QrCode, Copy, Gift,
} from "lucide-react";

type Participante = { uid: string; nombre: string; correo: string; push: boolean; fecha: string };
type Sorteo = { id: string; ganadorNombre: string; ganadorUid: string; premio: string | null; fecha: string; totalParticipantes: number };

export default function SorteoCampanaPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [campana, setCampana] = useState("expovino");
  const [localId, setLocalId] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [historial, setHistorial] = useState<Sorteo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [sorteando, setSorteando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [ganador, setGanador] = useState<{ uid: string; nombre: string; correo: string } | null>(null);
  const [premio, setPremio] = useState("");
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ── Auth gate ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        const ok = canAccessModPanel(u.email, (snap.data() as { rol?: string; roles?: string[] }) ?? null);
        setAutorizado(ok);
        if (!ok) router.replace("/");
      } catch { router.replace("/"); }
    });
    return () => unsub();
  }, [router]);

  // ── Cargar participantes e historial ──────────────────────────────────────
  const cargar = useCallback(async () => {
    const slug = campana.trim().toLowerCase();
    if (!slug) return;
    setCargando(true);
    try {
      const [socios, sorteos] = await Promise.all([
        getDocs(query(collection(db, "usuarios"), where("campanaRegistro", "==", slug))),
        getDocs(query(collection(db, "sorteos"), where("campana", "==", slug))),
      ]);
      setParticipantes(
        socios.docs
          .filter((d) => d.data().baneado !== true)
          .map((d) => {
            const x = d.data();
            return {
              uid: d.id,
              nombre: String(x.nombre ?? "").trim() || "(sin nombre)",
              correo: String(x.correo ?? "").trim(),
              push: !!x.fcmToken,
              fecha: String(x.campanaRegistroEn ?? x.createdAt ?? ""),
            };
          })
          .sort((a, b) => b.fecha.localeCompare(a.fecha)),
      );
      setHistorial(
        sorteos.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha))),
      );
    } catch (e: any) {
      toast({ variant: "destructive", title: "No se pudo cargar", description: e?.message });
    } finally {
      setCargando(false);
    }
  }, [campana, toast]);

  useEffect(() => { if (autorizado) void cargar(); }, [autorizado, cargar]);

  const token = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("Sin sesión activa");
    return u.getIdToken();
  };

  // ── Sortear ───────────────────────────────────────────────────────────────
  const sortear = async () => {
    setSorteando(true);
    setGanador(null);
    try {
      const res = await fetch("/api/admin/campana/sortear", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ campana: campana.trim().toLowerCase(), premio: premio.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo sortear");
      setGanador(data.ganador);
      setTitulo("¡Ganaste! 🎉");
      setMensaje(
        `Felicitaciones ${data.ganador.nombre}: saliste sorteado${premio.trim() ? ` y te ganaste ${premio.trim()}` : ""}. ` +
        `Acércate al mostrador del Club Patio Curauma para retirar tu premio.`,
      );
      toast({ title: "Ganador seleccionado 🏆", description: `${data.ganador.nombre} entre ${data.totalParticipantes} participantes.` });
      void cargar();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en el sorteo", description: e?.message });
    } finally {
      setSorteando(false);
    }
  };

  // ── Notificar ─────────────────────────────────────────────────────────────
  const notificar = async (soloGanador: boolean) => {
    if (!titulo.trim() || !mensaje.trim()) {
      toast({ variant: "destructive", title: "Falta contenido", description: "Escribe el título y el mensaje." });
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/admin/campana/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          campana: campana.trim().toLowerCase(),
          titulo: titulo.trim(),
          mensaje: mensaje.trim(),
          ...(soloGanador && ganador ? { userIds: [ganador.uid] } : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo enviar");
      toast({
        title: "Aviso enviado ✅",
        description: `${d.bandeja} en la app · ${d.pushEnviados} push · ${d.correosEnviados} correos.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al enviar", description: e?.message });
    } finally {
      setEnviando(false);
    }
  };

  // Apunta a /unete, no a /scan ni /canje: en un evento lo que se busca son
  // registros nuevos. /canje manda al handshake (esperar que un vendedor
  // confirme una venta) y sin sesión rebota a /?login=true. /unete abre el
  // formulario directo. El ref del local es opcional y solo sirve para
  // atribuirle el sello a un local; sin él se entrega el de bienvenida.
  const urlQR =
    `${CANONICAL_BASE_URL}/unete?evento=${campana.trim().toLowerCase()}` +
    (localId.trim() ? `&ref=${localId.trim()}` : "");
  const conPush = participantes.filter((p) => p.push).length;
  const conCorreo = participantes.filter((p) => p.correo).length;

  if (autorizado === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>;
  }
  if (!autorizado) return null;

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-base font-black text-slate-800 leading-tight">Sorteo por campaña</h1>
          <p className="text-[11px] text-slate-400 font-medium">Eventos y ferias</p>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* Campaña + QR */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Campaña</label>
          <div className="flex gap-2">
            <Input value={campana} onChange={(e) => setCampana(e.target.value)} placeholder="expovino" className="h-11 rounded-xl" />
            <Button onClick={cargar} disabled={cargando} variant="outline" className="h-11 rounded-xl px-3">
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 pt-1">
            <QrCode className="w-3 h-3" /> URL para el QR del mostrador
          </label>
          <Input value={localId} onChange={(e) => setLocalId(e.target.value)} placeholder="ID del local (opcional, para atribuir el sello)" className="h-10 rounded-xl text-xs" />
          <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2">
            <code className="text-[10px] text-slate-600 break-all flex-1 leading-relaxed">{urlQR}</code>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
              onClick={() => { navigator.clipboard.writeText(urlQR); toast({ title: "URL copiada" }); }}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Abre el registro directo. Quien se inscriba desde ese QR queda marcado
            en esta campaña y entra al sorteo. Deja el ID del local vacío si el
            sello de bienvenida no debe atribuirse a ningún local.
          </p>
        </section>

        {/* Participantes */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-black text-slate-800">Participantes</h2>
            </div>
            <span className="text-2xl font-black text-slate-800">{participantes.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-black text-emerald-700">{conCorreo}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide flex items-center justify-center gap-1"><Mail className="w-3 h-3" /> con correo</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-black text-amber-700">{conPush}</p>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide flex items-center justify-center gap-1"><Bell className="w-3 h-3" /> con push</p>
            </div>
          </div>
          {participantes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Todavía no hay inscritos en esta campaña.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {participantes.map((p) => (
                <div key={p.uid} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{p.nombre}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.correo || "sin correo"}</p>
                  </div>
                  {p.push && <Bell className="w-3 h-3 text-amber-500 shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sorteo */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-black text-slate-800">Sortear ganador</h2>
          </div>
          <Input value={premio} onChange={(e) => setPremio(e.target.value)} placeholder="Premio (opcional): ej. Caja de vinos" className="h-11 rounded-xl" />
          <Button onClick={sortear} disabled={sorteando || participantes.length === 0}
            className="w-full h-12 rounded-xl font-black gap-2" style={{ backgroundColor: "#D3B673" }}>
            {sorteando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {sorteando ? "Sorteando…" : "Elegir ganador al azar"}
          </Button>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            No puede salir dos veces la misma persona en esta campaña. Cada extracción queda registrada.
          </p>

          {ganador && (
            <div className="rounded-2xl p-4 text-center" style={{ background: "linear-gradient(135deg,#FEF3C7,#FDE68A)", border: "1px solid #F59E0B" }}>
              <Trophy className="w-7 h-7 mx-auto text-amber-600 mb-1.5" />
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Ganador</p>
              <p className="text-lg font-black text-slate-800 leading-tight">{ganador.nombre}</p>
              <p className="text-[11px] text-slate-500">{ganador.correo}</p>
            </div>
          )}
        </section>

        {/* Aviso */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-black text-slate-800">Enviar aviso</h2>
          </div>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className="h-11 rounded-xl" />
          <Textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Mensaje" rows={3} className="rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => notificar(true)} disabled={enviando || !ganador} variant="outline" className="h-11 rounded-xl font-bold text-xs gap-1">
              {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
              Solo al ganador
            </Button>
            <Button onClick={() => notificar(false)} disabled={enviando || participantes.length === 0}
              className="h-11 rounded-xl font-bold text-xs gap-1" style={{ backgroundColor: "#9DCC65" }}>
              {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              A todos ({participantes.length})
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Se envía por los tres canales: bandeja de la app (llega a todos), push (solo quien lo activó) y correo.
          </p>
        </section>

        {/* Historial */}
        {historial.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="text-sm font-black text-slate-800 mb-2">Sorteos anteriores</h2>
            <div className="divide-y divide-slate-100">
              {historial.map((s) => (
                <div key={s.id} className="py-2">
                  <p className="text-xs font-bold text-slate-700">🏆 {s.ganadorNombre}</p>
                  <p className="text-[10px] text-slate-400">
                    {s.premio ? `${s.premio} · ` : ""}{new Date(s.fecha).toLocaleString("es-CL")} · {s.totalParticipantes} participantes
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
