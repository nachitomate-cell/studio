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
import { BadgeCampana } from "@/components/BadgeCampana";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Loader2, Trophy, Users, Mail, Bell, Send, RefreshCw, QrCode, Copy, Gift,
  UserMinus, Trash2, Undo2, Tv, ExternalLink, Plus, RotateCcw,
} from "lucide-react";

type Participante = { uid: string; nombre: string; correo: string; push: boolean; fecha: string };
type Sorteo = { id: string; ganadorNombre: string; ganadorUid: string; premio: string | null; fecha: string; totalParticipantes: number };
type PremioCampana = {
  id: string; nombre: string; estado: "disponible" | "entregado";
  ganadorNombre?: string; entregadoEn?: string;
};

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
  const [premios, setPremios] = useState<PremioCampana[]>([]);
  const [premioNombre, setPremioNombre] = useState("");
  const [premioCantidad, setPremioCantidad] = useState(1);

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
      // El premio puede venir de la cola, no solo del campo escrito a mano.
      const ganado: string = data.premio ?? "";
      setMensaje(
        `Felicitaciones ${data.ganador.nombre}: saliste sorteado${ganado ? ` y te ganaste ${ganado}` : ""}. ` +
        `Acércate al mostrador del Club Patio Curauma para retirar tu premio.`,
      );
      toast({
        title: "Ganador seleccionado 🏆",
        description: `${data.ganador.nombre} entre ${data.totalParticipantes}` + (ganado ? ` · ${ganado}` : ""),
      });
      setPremio("");
      void cargar();
      void cargarPremios();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en el sorteo", description: e?.message });
    } finally {
      setSorteando(false);
    }
  };

  // ── Premios del momento ───────────────────────────────────────────────────
  const cargarPremios = useCallback(async () => {
    const slug = campana.trim().toLowerCase();
    if (!slug || !autorizado) return;
    try {
      const r = await fetch(`/api/admin/campana/premios?campana=${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setPremios(d.premios ?? []);
    } catch { /* no crítico */ }
  }, [campana, autorizado]);

  useEffect(() => { void cargarPremios(); }, [cargarPremios]);

  const agregarPremio = async () => {
    const nombre = premioNombre.trim();
    if (!nombre) { toast({ variant: "destructive", title: "Escribe el nombre del premio" }); return; }
    try {
      const r = await fetch("/api/admin/campana/premios", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ campana: campana.trim().toLowerCase(), nombre, cantidad: premioCantidad }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo agregar");
      toast({ title: "Premio agregado", description: `${d.agregados} unidad(es) de "${nombre}".` });
      setPremioNombre("");
      setPremioCantidad(1);
      void cargarPremios();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  };

  const borrarPremio = async (id: string) => {
    try {
      const r = await fetch("/api/admin/campana/premios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ campana: campana.trim().toLowerCase(), id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo borrar");
      void cargarPremios();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  };

  // ── Anular sorteos / reiniciar la ruleta ──────────────────────────────────
  const anularSorteos = async (reiniciarTodo = false) => {
    const aviso = reiniciarTodo
      ? "¿Reiniciar la ruleta? Se borran todos los sorteos, los premios vuelven a estar disponibles y la pantalla queda limpia."
      : "¿Anular todos los sorteos? Los premios entregados vuelven a la cola.";
    if (!confirm(aviso)) return;
    try {
      const res = await fetch("/api/admin/campana/sortear", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ campana: campana.trim().toLowerCase(), reiniciarTodo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo anular");
      setGanador(null);
      toast({
        title: reiniciarTodo ? "Ruleta reiniciada" : "Sorteos anulados",
        description: `${d.anulados} sorteo(s) · ${d.premiosDevueltos} premio(s) devuelto(s) a la cola.`,
      });
      void cargar();
      void cargarPremios();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  };

  // ── Quitar participantes ──────────────────────────────────────────────────
  const quitarParticipante = async (p: Participante, eliminarCuenta: boolean) => {
    const aviso = eliminarCuenta
      ? `¿Eliminar la CUENTA de ${p.nombre}? Se borra el perfil y el acceso. No se puede deshacer.`
      : `¿Sacar a ${p.nombre} de la campaña? La cuenta queda intacta, solo deja de participar.`;
    if (!confirm(aviso)) return;
    try {
      const res = await fetch("/api/admin/campana/participante", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ uid: p.uid, campana: campana.trim().toLowerCase(), eliminarCuenta }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo quitar");
      toast({
        title: eliminarCuenta ? "Cuenta eliminada" : "Sacado de la campaña",
        description: d.aviso ?? `${p.nombre} ya no participa.`,
      });
      void cargar();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
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

        {/* Acceso a la pantalla del stand. Abre en otra pestaña para no perder
            este panel: durante el evento se opera desde acá y se proyecta allá. */}
        <a
          href={`/expovino/pantalla?campana=${encodeURIComponent(campana.trim().toLowerCase())}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-2xl border transition-colors hover:bg-slate-800"
          style={{ background: "#1a1a2e", borderColor: "rgba(255,255,255,0.12)" }}
        >
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(211,182,115,0.18)" }}>
            <Tv className="w-5 h-5" style={{ color: "#D3B673" }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white leading-tight">Abrir pantalla del stand</p>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              Contador en vivo y QR · pulsa F11 para pantalla completa
            </p>
          </div>
          <ExternalLink className="w-4 h-4 shrink-0 text-slate-500" />
        </a>

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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate">{p.nombre}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.correo || "sin correo"}</p>
                  </div>
                  {p.push && <Bell className="w-3 h-3 text-amber-500 shrink-0" />}
                  <button onClick={() => quitarParticipante(p, false)}
                    title="Sacar de la campaña (la cuenta queda)"
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => quitarParticipante(p, true)}
                    title="Eliminar la cuenta por completo"
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Premios del momento */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-black text-slate-800">Premios del momento</h2>
            </div>
            <span className="text-xs font-black text-emerald-600">
              {premios.filter((p) => p.estado === "disponible").length} por entregar
            </span>
          </div>

          <div className="flex gap-2">
            <Input value={premioNombre} onChange={(e) => setPremioNombre(e.target.value)}
              placeholder="Ej. Caja de vinos" className="h-11 rounded-xl flex-1" />
            <Input type="number" min={1} max={50} value={premioCantidad}
              onChange={(e) => setPremioCantidad(Math.max(1, Number(e.target.value) || 1))}
              className="h-11 rounded-xl w-16 text-center" />
            <Button onClick={agregarPremio} className="h-11 rounded-xl px-4 font-bold"
              style={{ backgroundColor: "#9DCC65" }}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Cada sorteo consume un premio. Desde la ruleta se elige al azar entre
            los disponibles; desde el botón de abajo, el más antiguo de la cola.
          </p>

          {/* Reinicio: lo que se usa para dejar todo limpio antes del evento */}
          <button
            onClick={() => anularSorteos(true)}
            className="w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar ruleta — devuelve todos los premios
          </button>

          {premios.length > 0 && (
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
              {premios.map((p) => (
                <div key={p.id} className="py-2 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.estado === "disponible" ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${p.estado === "disponible" ? "text-slate-700" : "text-slate-400 line-through"}`}>
                      {p.nombre}
                    </p>
                    {p.estado === "entregado" && (
                      <p className="text-[10px] text-slate-400 truncate">🏆 {p.ganadorNombre}</p>
                    )}
                  </div>
                  {p.estado === "disponible" && (
                    <button onClick={() => borrarPremio(p.id)}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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
          <Input value={premio} onChange={(e) => setPremio(e.target.value)}
            placeholder="Dejar vacío para tomar el siguiente de la cola" className="h-11 rounded-xl" />
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
              <p className="text-[11px] text-slate-500 mb-2">{ganador.correo}</p>
              <BadgeCampana campana={campana.trim().toLowerCase()} tamano="chico" />
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-800">Sorteos anteriores</h2>
              <button onClick={() => anularSorteos(false)}
                className="text-[11px] font-bold text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                <Undo2 className="w-3 h-3" /> Anular todos
              </button>
            </div>
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
