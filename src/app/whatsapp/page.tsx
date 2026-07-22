"use client";

/**
 * /whatsapp — Marketing por WhatsApp del Club Patio (solo moderadores).
 *
 * Campañas segmentadas sobre el número PROPIO del club (Evolution, VPS
 * SynapTech) con la doctrina anti-ban completa visible en pantalla:
 * opt-in de audiencia (teléfono del perfil, STOP automático), tope 50/día,
 * ventana 11:00–20:00, lotes con pausa, plantillas rotadas con variables.
 * Sin IA: las redacciones las escribe el moderador (variables {nombre},
 * {sellos}, {faltan} personalizan cada mensaje).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { canAccessModPanel } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, MessageCircle, QrCode, Send, Pause, Play, Users,
  ShieldCheck, Clock, RefreshCw, Plug, PlugZap, FileSpreadsheet,
} from "lucide-react";
import {
  CANDADOS, SEGMENTOS, SEGMENTO_EXCEL, MAX_LISTA_EXCEL, segmentoLabel,
  type SegmentoId, type CampanaResumen, renderPlantilla, PIE_OPT_OUT,
} from "@/lib/waMarketing";

type ContactoExcel = { nombre: string; telefono: string };

/**
 * Parsea un Excel/CSV a [{nombre, telefono}]. Detecta las columnas por
 * encabezado (tel/fono/celular/whatsapp · nombre/cliente) y, si no hay
 * encabezados, busca la columna con más valores con pinta de teléfono.
 * La normalización dura (formato chileno, dedup, opt-outs) la hace el server.
 */
async function parseArchivoContactos(file: File): Promise<ContactoExcel[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
  if (!rows.length) return [];
  const norm = (v: unknown) => String(v ?? "").trim();

  const header = (rows[0] || []).map(v => norm(v).toLowerCase());
  let colTel = header.findIndex(h => /tel|fono|celu|whats|m[oó]vil|phone/.test(h));
  const colNomHeader = header.findIndex(h => /nombre|name|cliente|socio/.test(h));
  const conEncabezado = colTel >= 0 || colNomHeader >= 0;
  const dataRows = conEncabezado ? rows.slice(1) : rows;

  if (colTel < 0) {
    const nCols = Math.max(0, ...dataRows.map(r => r.length));
    let mejores = 0;
    for (let c = 0; c < nCols; c++) {
      const hits = dataRows.filter(r => {
        const v = norm(r[c]);
        return /^[\d\s()+.-]{8,16}$/.test(v) && v.replace(/\D/g, "").length >= 8;
      }).length;
      if (hits > mejores) { mejores = hits; colTel = c; }
    }
  }
  if (colTel < 0) return [];
  const colNom = colNomHeader >= 0 ? colNomHeader : (colTel === 0 ? 1 : 0);

  return dataRows
    .map(r => ({ nombre: norm(r[colNom]), telefono: norm(r[colTel]) }))
    .filter(x => x.telefono);
}

type Conexion = "connected" | "qr" | "disconnected" | "cargando";

const PLANTILLA_EJEMPLO =
  "¡Hola {nombre}! 👋 Este finde el Patio está imperdible.\n" +
  "Llevas {sellos} sellos y te faltan solo {faltan} para tu próximo premio 🎁\n" +
  "Pasa por tu local favorito y sigue sumando. ¡Te esperamos!";

export default function WhatsAppMarketingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);

  const [conexion, setConexion] = useState<Conexion>("cargando");
  const [qr, setQr] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [campanas, setCampanas] = useState<CampanaResumen[]>([]);
  const [enviadosHoy, setEnviadosHoy] = useState(0);

  // ── Form nueva campaña ──
  const [nombre, setNombre] = useState("");
  const [segmento, setSegmento] = useState<SegmentoId>("todos");
  const [plantillas, setPlantillas] = useState<string[]>([PLANTILLA_EJEMPLO]);
  const [audiencia, setAudiencia] = useState<number | null>(null);
  const [descartados, setDescartados] = useState(0);
  const [creando, setCreando] = useState(false);

  // ── Lista propia (Excel/CSV) ──
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [listaExcel, setListaExcel] = useState<ContactoExcel[] | null>(null);
  const [archivoNombre, setArchivoNombre] = useState("");

  const onArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    try {
      const contactos = await parseArchivoContactos(file);
      if (!contactos.length) {
        toast({ title: "No encontré teléfonos en el archivo", description: "Revisa que tenga una columna de teléfonos (y opcionalmente una de nombres).", variant: "destructive" });
        return;
      }
      setListaExcel(contactos.slice(0, MAX_LISTA_EXCEL));
      setArchivoNombre(file.name);
      setSegmento(SEGMENTO_EXCEL.id);
      setAudiencia(null);
      setDescartados(0);
      if (contactos.length > MAX_LISTA_EXCEL) {
        toast({ title: `Lista recortada a ${MAX_LISTA_EXCEL} contactos`, description: "Divide el archivo si necesitas más." });
      }
    } catch {
      toast({ title: "No pude leer el archivo", description: "Usa formato .xlsx, .xls o .csv.", variant: "destructive" });
    }
  };

  // ── Auth gate (mismo criterio que /moderador: allowlist o rol staff) ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) { setAutorizado(false); router.push("/"); return; }
      if (canAccessModPanel(u.email, null)) { setAutorizado(true); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        setAutorizado(canAccessModPanel(u.email, (snap.data() as { rol?: string; roles?: string[] }) ?? null));
      } catch {
        setAutorizado(false);
      }
    });
    return () => unsub();
  }, [router]);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }, []);

  const cargarTodo = useCallback(async () => {
    try {
      const d = await api("/api/whatsapp/campanas");
      setCampanas(d.campanas || []);
      setConexion(d.conexion === "connected" ? "connected" : "disconnected");
      setEnviadosHoy(d.enviadosHoy || 0);
    } catch { /* la vista muestra el último estado conocido */ }
  }, [api]);

  useEffect(() => {
    if (autorizado) void cargarTodo();
  }, [autorizado, cargarTodo]);

  // ── Vinculación con polling del QR ──
  const detenerPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const vincular = async () => {
    setVinculando(true);
    try {
      const d = await api("/api/whatsapp/estado", { method: "POST" });
      setQr(d.qr || null);
      setConexion("qr");
      detenerPoll();
      pollRef.current = setInterval(async () => {
        try {
          const e = await api("/api/whatsapp/estado");
          if (e.estado === "connected") {
            detenerPoll();
            setQr(null);
            setConexion("connected");
            toast({ title: "✅ WhatsApp conectado", description: "El número del club quedó vinculado." });
          } else if (e.qr) {
            setQr(e.qr);   // QR fresco (caducan rápido)
          }
        } catch { /* reintenta en el próximo tick */ }
      }, 5000);
    } catch (e) {
      toast({ title: "No se pudo iniciar la vinculación", description: (e as Error).message, variant: "destructive" });
    } finally {
      setVinculando(false);
    }
  };

  useEffect(() => detenerPoll, []);

  // ── Campañas ──
  const esExcel = segmento === SEGMENTO_EXCEL.id;

  const previewAudiencia = async () => {
    if (esExcel && !listaExcel?.length) {
      toast({ title: "Sube primero el archivo", description: "La audiencia Excel sale del archivo que cargues.", variant: "destructive" });
      return;
    }
    setAudiencia(null);
    try {
      const d = await api("/api/whatsapp/campanas", {
        method: "POST",
        body: JSON.stringify({ segmento, dryRun: true, ...(esExcel ? { clientes: listaExcel } : {}) }),
      });
      setAudiencia(d.audiencia);
      setDescartados(d.descartados || 0);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const crearCampana = async () => {
    if (esExcel && !listaExcel?.length) {
      toast({ title: "Sube primero el archivo", description: "La audiencia Excel sale del archivo que cargues.", variant: "destructive" });
      return;
    }
    setCreando(true);
    try {
      const d = await api("/api/whatsapp/campanas", {
        method: "POST",
        body: JSON.stringify({
          nombre, segmento, plantillas: plantillas.filter(p => p.trim()),
          ...(esExcel ? { clientes: listaExcel } : {}),
        }),
      });
      toast({ title: "🚀 Campaña creada", description: `${d.audiencia} contactos en cola. Sale sola dentro de la ventana horaria.` });
      setNombre(""); setPlantillas([PLANTILLA_EJEMPLO]); setAudiencia(null); setDescartados(0);
      setListaExcel(null); setArchivoNombre("");
      void cargarTodo();
    } catch (e) {
      toast({ title: "No se pudo crear", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreando(false);
    }
  };

  const accionCampana = async (id: string, accion: "pausar" | "reanudar" | "cancelar") => {
    try {
      await api("/api/whatsapp/campanas", { method: "PATCH", body: JSON.stringify({ id, accion }) });
      void cargarTodo();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (autorizado === null) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!autorizado) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">Solo moderadores</p>
        <p className="text-sm text-muted-foreground">Tu cuenta ({user?.email}) no tiene acceso a esta sección.</p>
      </div>
    );
  }

  const preview = renderPlantilla(plantillas[0] || "", { nombre: "Camila", sellos: 7 }) + PIE_OPT_OUT;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-green-500/15 text-green-600">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Marketing por WhatsApp</h1>
          <p className="text-xs text-muted-foreground">Campañas al número propio del club · con candados anti-bloqueo</p>
        </div>
      </header>

      {/* ── Conexión ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              {conexion === "connected" ? <PlugZap className="h-4 w-4 text-green-600" /> : <Plug className="h-4 w-4 text-muted-foreground" />}
              Número del club
            </span>
            <Badge variant={conexion === "connected" ? "default" : "secondary"}>
              {conexion === "connected" ? "Conectado" : conexion === "qr" ? "Escanea el QR" : conexion === "cargando" ? "…" : "Desconectado"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conexion !== "connected" && (
            <>
              {qr ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR de vinculación" className="h-56 w-56" />
                  <p className="text-center text-xs text-muted-foreground">
                    En el teléfono del club: WhatsApp → Dispositivos vinculados → Vincular dispositivo
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Vincula el WhatsApp del club para poder enviar campañas. Usa un número con historial
                  (nunca un chip recién comprado) — reduce el riesgo de bloqueo.
                </p>
              )}
              <Button onClick={vincular} disabled={vinculando} className="w-full">
                {vinculando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                {qr ? "Generar QR nuevo" : "Vincular WhatsApp del club"}
              </Button>
            </>
          )}
          {conexion === "connected" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Enviados hoy</span>
              <span className="font-bold tabular-nums">{enviadosHoy} / {CANDADOS.CAP_DIARIO}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Nueva campaña ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4" /> Nueva campaña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Nombre interno (ej: Finde Bazar Outlet)" value={nombre} onChange={e => setNombre(e.target.value)} />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audiencia</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SEGMENTOS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSegmento(s.id); setAudiencia(null); setDescartados(0); }}
                  className={`rounded-xl border p-3 text-left transition-colors ${segmento === s.id ? "border-green-600 bg-green-500/10" : "hover:bg-muted/50"}`}
                >
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (listaExcel?.length) { setSegmento(SEGMENTO_EXCEL.id); setAudiencia(null); setDescartados(0); }
                  else fileRef.current?.click();
                }}
                className={`rounded-xl border p-3 text-left transition-colors sm:col-span-2 ${esExcel ? "border-green-600 bg-green-500/10" : "hover:bg-muted/50"}`}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileSpreadsheet className="h-4 w-4" /> Lista propia (Excel / CSV)
                </p>
                <p className="text-xs text-muted-foreground">
                  {listaExcel?.length
                    ? `${archivoNombre} · ${listaExcel.length} contactos leídos — toca de nuevo para usarla`
                    : "Sube un archivo con una columna de teléfonos (y opcionalmente nombres). Pasa por los mismos candados: opt-outs, tope diario y pausas."}
                </p>
                {listaExcel?.length ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => { ev.stopPropagation(); fileRef.current?.click(); }}
                    onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); fileRef.current?.click(); } }}
                    className="mt-1 inline-block text-xs font-semibold text-green-600 underline-offset-2 hover:underline"
                  >
                    Cambiar archivo
                  </span>
                ) : null}
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onArchivo} />
            {esExcel && (
              <p className="mt-2 text-xs text-amber-600">
                Ojo: si un contacto de la lista no es socio del club, <code>{"{sellos}"}</code> será 0 y <code>{"{faltan}"}</code> 10 —
                para listas externas usa <code>{"{nombre}"}</code> o texto sin variables.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-2" onClick={previewAudiencia}>
              <Users className="mr-1.5 h-3.5 w-3.5" />
              {audiencia === null
                ? "Ver tamaño de la audiencia"
                : `${audiencia} elegibles${descartados ? ` · ${descartados} descartados (inválidos, repetidos u opt-out)` : ""}`}
            </Button>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mensajes (hasta {CANDADOS.MAX_PLANTILLAS} redacciones — rotan para no repetir el mismo texto)
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Variables: <code>{"{nombre}"}</code> · <code>{"{sellos}"}</code> · <code>{"{faltan}"}</code>.
              El pie &quot;responde STOP&quot; se agrega solo.
            </p>
            {plantillas.map((p, i) => (
              <textarea
                key={i}
                value={p}
                onChange={e => setPlantillas(arr => arr.map((x, j) => (j === i ? e.target.value : x)))}
                rows={4}
                className="mb-2 w-full rounded-xl border bg-background p-3 text-sm"
                placeholder={`Redacción ${i + 1}`}
              />
            ))}
            {plantillas.length < CANDADOS.MAX_PLANTILLAS && (
              <Button variant="ghost" size="sm" onClick={() => setPlantillas(a => [...a, ""])}>
                + Agregar otra redacción
              </Button>
            )}
          </div>

          {plantillas[0]?.trim() && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Vista previa (socia: Camila, 7 sellos)</p>
              <p className="whitespace-pre-wrap text-sm">{preview}</p>
            </div>
          )}

          <Button onClick={crearCampana} disabled={creando || conexion !== "connected" || (esExcel && !listaExcel?.length)} className="w-full">
            {creando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {conexion !== "connected"
              ? "Conecta el WhatsApp primero"
              : esExcel && !listaExcel?.length
                ? "Sube el archivo de la lista primero"
                : "Crear campaña (sale sola, con candados)"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Campañas ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Campañas</span>
            <Button variant="ghost" size="sm" onClick={() => void cargarTodo()}><RefreshCw className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {campanas.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Aún no hay campañas.</p>}
          {campanas.map(c => {
            const pct = c.total ? Math.round((c.enviados / c.total) * 100) : 0;
            return (
              <div key={c.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {segmentoLabel(c.segmento)} · {c.enviados}/{c.total} enviados
                      {c.fallidos > 0 ? ` · ${c.fallidos} fallidos` : ""}
                      {c.optouts > 0 ? ` · ${c.optouts} opt-out` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={c.estado === "activa" ? "default" : c.estado === "pausada" ? "secondary" : "outline"}>
                      {c.estado}
                    </Badge>
                    {c.estado === "activa" && (
                      <Button variant="ghost" size="icon" onClick={() => accionCampana(c.id, "pausar")}><Pause className="h-4 w-4" /></Button>
                    )}
                    {c.estado === "pausada" && (
                      <Button variant="ghost" size="icon" onClick={() => accionCampana(c.id, "reanudar")}><Play className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Candados visibles ── */}
      <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground"><Clock className="h-3.5 w-3.5" /> Cómo protege tu número</p>
        Máximo {CANDADOS.CAP_DIARIO} mensajes al día · solo entre {CANDADOS.VENTANA_INICIO}:00 y {CANDADOS.VENTANA_FIN}:00 ·
        pausas de {Math.round(CANDADOS.PAUSA_MIN_MS / 1000)}–{Math.round(CANDADOS.PAUSA_MAX_MS / 1000)} s entre mensajes ·
        cada socio recibe una redacción personalizada · quien responde STOP queda excluido para siempre, automáticamente.
        Una campaña grande puede tardar varios días en salir completa — eso es a propósito.
      </div>
    </div>
  );
}
