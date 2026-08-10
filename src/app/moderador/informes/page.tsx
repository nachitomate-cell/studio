"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  Loader2, ChevronLeft, FileText, Upload, Trash2, ExternalLink, Building2, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  INFORMES_COLLECTION, MAX_INFORME_BYTES, formatearPeso, formatearFechaInforme,
  type AlcanceInforme, type Informe,
} from "@/lib/informes";
import { ADMIN_EMAIL, ROLES_STAFF_PANEL } from "@/lib/constants";

type Comercio = { id: string; nombre: string };

function tituloPorDefecto(): string {
  const hoy = new Date().toLocaleDateString("es-CL", {
    day: "2-digit", month: "long", year: "numeric",
  });
  return `Informe semanal · ${hoy}`;
}

export default function ModeradorInformesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [informes, setInformes] = useState<Informe[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);

  const [alcance, setAlcance] = useState<AlcanceInforme>("comercio");
  const [vendorId, setVendorId] = useState("");
  const [titulo, setTitulo] = useState(tituloPorDefecto);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAuthLoading(false); router.replace("/"); return; }
      if (user.email === ADMIN_EMAIL) {
        setAuthorized(true); setAuthLoading(false); return;
      }
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        const data = snap.exists() ? snap.data() : null;
        const rol: string = data?.rol ?? "";
        const roles: string[] = Array.isArray(data?.roles) ? data.roles : [];
        if (ROLES_STAFF_PANEL.includes(rol) || roles.some((r) => ROLES_STAFF_PANEL.includes(r))) {
          setAuthorized(true);
        } else {
          router.replace("/");
        }
      } catch { router.replace("/"); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Datos ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authorized) return;

    getDocs(collection(db, "entrepreneur_profiles")).then((snap) => {
      const lista = snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, nombre: data?.businessName || data?.nombre || "(sin nombre)" };
      });
      setComercios(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });

    const unsub = onSnapshot(
      query(collection(db, INFORMES_COLLECTION), orderBy("creadoEn", "desc"), limit(200)),
      (snap) => {
        setInformes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Informe)));
        setLoading(false);
      },
      (err) => {
        console.error("[moderador/informes]", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [authorized]);

  const informesGenerales = useMemo(
    () => informes.filter((i) => i.alcance === "general"),
    [informes],
  );

  // ── Acciones ───────────────────────────────────────────────────────────────
  const subir = async () => {
    if (!archivo) {
      toast({ title: "Falta el PDF", description: "Elige el archivo del informe.", variant: "destructive" });
      return;
    }
    if (!titulo.trim()) {
      toast({ title: "Falta el título", description: "Ponle un nombre reconocible.", variant: "destructive" });
      return;
    }
    if (alcance === "comercio" && !vendorId) {
      toast({ title: "Falta el comercio", description: "Elige a quién va dirigido.", variant: "destructive" });
      return;
    }
    if (archivo.size > MAX_INFORME_BYTES) {
      toast({ title: "Archivo muy pesado", description: "El máximo son 20 MB.", variant: "destructive" });
      return;
    }

    setSubiendo(true);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const form = new FormData();
      form.append("file", archivo);
      form.append("titulo", titulo.trim());
      form.append("alcance", alcance);
      if (alcance === "comercio") form.append("vendorId", vendorId);

      const res = await fetch("/api/admin/informes", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);

      toast({
        title: "Informe publicado",
        description: `${data.notificados} comercio(s) avisados · ${data.pushEnviados} con push.`,
      });
      setArchivo(null);
      setTitulo(tituloPorDefecto());
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast({ title: "No se pudo subir", description: e?.message ?? "Error inesperado", variant: "destructive" });
    } finally {
      setSubiendo(false);
    }
  };

  const abrir = async (informe: Informe) => {
    setAbriendo(informe.id);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch("/api/informes/url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ id: informe.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "No se pudo abrir", description: e?.message ?? "Error inesperado", variant: "destructive" });
    } finally {
      setAbriendo(null);
    }
  };

  const eliminar = async (informe: Informe) => {
    const destinatario = informe.alcance === "general" ? "todo el club" : informe.vendorNombre;
    if (!window.confirm(`¿Eliminar "${informe.titulo}" (${destinatario})? El comercio dejará de verlo.`)) return;

    setBorrando(informe.id);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/admin/informes?id=${encodeURIComponent(informe.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
      toast({ title: "Informe eliminado" });
    } catch (e: any) {
      toast({ title: "No se pudo eliminar", description: e?.message ?? "Error inesperado", variant: "destructive" });
    } finally {
      setBorrando(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading || !authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/60 pb-24 font-sans">
      <div className="bg-white border-b border-slate-200 p-5 sticky top-0 z-10 flex items-center gap-3">
        <Link href="/moderador">
          <Button variant="ghost" size="icon" className="text-slate-400">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-black text-slate-800">Informes</h1>
          <p className="text-xs text-slate-400 font-medium">Publica el informe y el comercio lo ve en su app</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-5 space-y-6">

        {/* ── Subir ── */}
        <Card className="border-none shadow-md rounded-3xl bg-white">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide">Publicar informe</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAlcance("comercio")}
                className={`rounded-2xl p-4 text-left transition-all border-2 ${
                  alcance === "comercio"
                    ? "border-primary bg-primary/5"
                    : "border-slate-100 bg-slate-50 hover:border-slate-200"
                }`}
              >
                <Building2 className={`w-5 h-5 mb-1.5 ${alcance === "comercio" ? "text-primary" : "text-slate-400"}`} />
                <p className="text-sm font-bold text-slate-800">De un comercio</p>
                <p className="text-[11px] text-slate-400">Solo lo ve ese local</p>
              </button>
              <button
                type="button"
                onClick={() => setAlcance("general")}
                className={`rounded-2xl p-4 text-left transition-all border-2 ${
                  alcance === "general"
                    ? "border-primary bg-primary/5"
                    : "border-slate-100 bg-slate-50 hover:border-slate-200"
                }`}
              >
                <Globe className={`w-5 h-5 mb-1.5 ${alcance === "general" ? "text-primary" : "text-slate-400"}`} />
                <p className="text-sm font-bold text-slate-800">General del club</p>
                <p className="text-[11px] text-slate-400">Lo ven todos los comercios</p>
              </button>
            </div>

            {alcance === "comercio" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Comercio</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Elige un comercio…</option>
                  {comercios.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Título</label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Informe semanal · 11 de agosto de 2026"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Archivo PDF</label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-slate-600 hover:file:bg-slate-200"
              />
              {archivo && (
                <p className="text-[11px] text-slate-400 font-medium">
                  {archivo.name} · {formatearPeso(archivo.size)}
                </p>
              )}
            </div>

            <Button
              onClick={subir}
              disabled={subiendo}
              className="w-full h-12 rounded-2xl font-bold gap-2"
              style={{ backgroundColor: "#D3B673", color: "#fff" }}
            >
              {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {subiendo ? "Publicando…" : "Publicar y avisar"}
            </Button>
            <p className="text-[11px] text-slate-400 text-center">
              Al publicar le llega una notificación al comercio. El informe queda guardado para que lo revise cuando quiera.
            </p>
          </CardContent>
        </Card>

        {/* ── Publicados ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">
              Publicados ({informes.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              {informesGenerales.length} general(es)
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : informes.length === 0 ? (
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardContent className="p-10 text-center">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">Todavía no hay informes publicados</p>
              </CardContent>
            </Card>
          ) : (
            informes.map((informe) => (
              <Card key={informe.id} className="border-none shadow-sm rounded-2xl bg-white">
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: informe.alcance === "general" ? "#6366f115" : "#D3B67318" }}
                  >
                    {informe.alcance === "general"
                      ? <Globe className="w-5 h-5 text-indigo-500" />
                      : <Building2 className="w-5 h-5" style={{ color: "#D3B673" }} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{informe.titulo}</p>
                    <p className="text-[11px] text-slate-400 font-medium truncate">
                      {informe.alcance === "general" ? "Todos los comercios" : informe.vendorNombre}
                      {" · "}{formatearFechaInforme(informe.creadoEn)}
                      {" · "}{formatearPeso(informe.tamanoBytes)}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => abrir(informe)}
                    disabled={abriendo === informe.id}
                    className="rounded-xl border-slate-200 text-slate-500 shrink-0"
                  >
                    {abriendo === informe.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ExternalLink className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => eliminar(informe)}
                    disabled={borrando === informe.id}
                    className="rounded-xl border-red-100 text-red-400 hover:bg-red-50 shrink-0"
                  >
                    {borrando === informe.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
