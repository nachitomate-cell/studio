"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  Loader2, ChevronLeft, FileText, FileSpreadsheet, Download, CalendarRange, Users, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  etiquetaArchivo, formatearPesoReporte, formatearRangoReporte, nombreArchivoPlanilla,
  type ReporteSemanalPublico,
} from "@/lib/reportesSemanales";
import { canAccessModPanel } from "@/lib/constants";

/** Saca el nombre del Content-Disposition (prefiere filename* con tildes). */
function nombreDesdeDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try { return decodeURIComponent(utf8[1]); } catch { /* cae al ASCII */ }
  }
  const ascii = /filename="([^"]+)"/i.exec(header);
  return ascii ? ascii[1] : null;
}

/** Dispara la descarga sin abrir pestañas (los bloqueadores de popups no la frenan). */
function descargarDesde(href: string, nombre?: string) {
  const a = document.createElement("a");
  a.href = href;
  if (nombre) a.download = nombre;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function ModeradorReportesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [reportes, setReportes] = useState<ReporteSemanalPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const [generandoPlanilla, setGenerandoPlanilla] = useState(false);
  /** `${id}:${indice}` del archivo que se está pidiendo. */
  const [descargando, setDescargando] = useState<string | null>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAuthLoading(false); router.replace("/"); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        // Mismo criterio que las APIs de /api/admin/reportes (canAccessModPanel):
        // si la pantalla exigiera otra cosa, alguien la vería con las descargas rotas.
        if (canAccessModPanel(user.email, snap.exists() ? (snap.data() as any) : null)) {
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
  // La colección no se lee desde el cliente (no tiene regla): la lista sale de la API.
  const cargarReportes = useCallback(async () => {
    setLoading(true);
    setErrorLista(null);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch("/api/admin/reportes", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
      setReportes(Array.isArray(data.reportes) ? data.reportes : []);
    } catch (e: any) {
      console.error("[moderador/reportes]", e);
      setErrorLista(e?.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) cargarReportes();
  }, [authorized, cargarReportes]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  const descargarPlanilla = async () => {
    setGenerandoPlanilla(true);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch("/api/admin/reportes/planilla", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const nombre =
        nombreDesdeDisposition(res.headers.get("Content-Disposition")) ?? nombreArchivoPlanilla();
      const url = URL.createObjectURL(blob);
      descargarDesde(url, nombre);
      // Se suelta después: algunos navegadores leen el blob recién tras el clic.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      const autorizan = Number(res.headers.get("X-Planilla-Autorizan"));
      const total = Number(res.headers.get("X-Planilla-Total"));
      toast({
        title: "Planilla descargada",
        description:
          Number.isFinite(autorizan) && Number.isFinite(total) && total > 0
            ? `${autorizan.toLocaleString("es-CL")} socios autorizan correo, de ${total.toLocaleString("es-CL")} en total.`
            : nombre,
      });
    } catch (e: any) {
      toast({ title: "No se pudo generar la planilla", description: e?.message ?? "Error inesperado", variant: "destructive" });
    } finally {
      setGenerandoPlanilla(false);
    }
  };

  const descargarArchivo = async (reporte: ReporteSemanalPublico, indice: number) => {
    const clave = `${reporte.id}:${indice}`;
    setDescargando(clave);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch(
        `/api/admin/reportes/url?id=${encodeURIComponent(reporte.id)}&i=${indice}`,
        { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
      // La signed URL ya viene como attachment con el nombre original.
      descargarDesde(data.url);
    } catch (e: any) {
      toast({ title: "No se pudo descargar", description: e?.message ?? "Error inesperado", variant: "destructive" });
    } finally {
      setDescargando(null);
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
          <h1 className="text-lg font-black text-slate-800">Reportes semanales</h1>
          <p className="text-xs text-slate-400 font-medium">El reporte del Club y la planilla de socios, cuando los necesites</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-5 space-y-6">

        {/* ── Planilla al día ── */}
        <Card className="border-none shadow-md rounded-3xl bg-white">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide">Planilla de socios al día</h2>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed">
              Se genera en el momento con los socios registrados hasta ahora. Trae dos hojas:
            </p>
            <ul className="space-y-2 text-sm text-slate-500">
              <li className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <span className="font-bold text-emerald-700">Autorizan correo:</span>{" "}
                solo quienes aceptaron recibir correos, con la fecha en que lo hicieron.
                Es la única que se carga en la plataforma de correo.
              </li>
              <li className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3">
                <span className="font-bold text-red-700">Base completa (NO enviar):</span>{" "}
                todos los socios, autoricen o no. Es solo para consulta interna y nunca se carga
                en la plataforma de correo.
              </li>
            </ul>

            <Button
              onClick={descargarPlanilla}
              disabled={generandoPlanilla}
              className="w-full h-12 rounded-2xl font-bold gap-2"
              style={{ backgroundColor: "#D3B673", color: "#fff" }}
            >
              {generandoPlanilla ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generandoPlanilla ? "Generando planilla…" : "Descargar planilla de hoy"}
            </Button>
            <p className="text-[11px] text-slate-400 text-center">
              Trae nombre, correo y teléfono de cada socio: guárdala en un lugar seguro y no la reenvíes.
            </p>
          </CardContent>
        </Card>

        {/* ── Archivo semanal ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">
              Reportes archivados{!loading && !errorLista ? ` (${reportes.length})` : ""}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={cargarReportes}
              disabled={loading}
              className="text-slate-400 gap-1.5 rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : errorLista ? (
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardContent className="p-8 text-center space-y-3">
                <p className="text-sm font-bold text-slate-500">No se pudo cargar la lista de reportes</p>
                <p className="text-xs text-slate-400">{errorLista}</p>
                <Button variant="outline" onClick={cargarReportes} className="rounded-xl">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : reportes.length === 0 ? (
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardContent className="p-10 text-center">
                <CalendarRange className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">Todavía no hay reportes archivados</p>
                <p className="text-xs text-slate-400 mt-1">
                  Cada semana aparecerá aquí el reporte del Club para que lo descargues cuando quieras.
                  Mientras tanto, la planilla de arriba siempre está al día.
                </p>
              </CardContent>
            </Card>
          ) : (
            reportes.map((reporte) => (
              <Card key={reporte.id} className="border-none shadow-sm rounded-2xl bg-white">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                      <CalendarRange className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">{reporte.titulo}</p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {formatearRangoReporte(reporte.desde, reporte.hasta)}
                      </p>
                    </div>
                  </div>

                  {reporte.archivos.length === 0 ? (
                    <p className="text-xs text-slate-400">Este reporte no tiene archivos.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {reporte.archivos.map((archivo, indice) => {
                        const clave = `${reporte.id}:${indice}`;
                        const Icono = archivo.tipo === "pdf" ? FileText : FileSpreadsheet;
                        return (
                          <Button
                            key={clave}
                            variant="outline"
                            onClick={() => descargarArchivo(reporte, indice)}
                            disabled={descargando === clave}
                            title={archivo.nombre}
                            className="rounded-xl border-slate-200 text-slate-600 gap-2 h-10"
                          >
                            {descargando === clave
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Icono className={`w-4 h-4 ${archivo.tipo === "pdf" ? "text-red-500" : "text-emerald-600"}`} />}
                            <span className="font-bold text-xs">{etiquetaArchivo(archivo.tipo)}</span>
                            <span className="text-[11px] text-slate-400">{formatearPesoReporte(archivo.tamanoBytes)}</span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
