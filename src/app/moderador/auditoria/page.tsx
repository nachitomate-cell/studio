"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, getDocs, getDoc, doc, writeBatch, deleteDoc,
  query, orderBy, limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  Loader2, ChevronLeft, Download, Trash2, AlertTriangle,
  ShieldCheck, FileSpreadsheet, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";


const MASTER_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com";
const CONFIRM_WORD = "CONFIRMAR";

// ── Helpers ────────────────────────────────────────────────────────────────

function parseFecha(v: unknown): Date | null {
  if (!v) return null;
  if (typeof (v as any).toDate === "function") return (v as any).toDate();
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return null;
}

function fmtFecha(d: Date | null): string {
  if (!d) return "N/A";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Borra todos los documentos de una colección en batches de 500. */
async function deleteCollection(colPath: string): Promise<number> {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await getDocs(query(collection(db, colPath), limit(500)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.docs.length;
  }
  return deleted;
}

/** Reset numérico en usuarios en batches de 500. */
async function resetUserStamps(): Promise<number> {
  let processed = 0;
  const snap = await getDocs(collection(db, "usuarios"));
  const batches: ReturnType<typeof writeBatch>[] = [];
  let batch = writeBatch(db);
  let count = 0;
  snap.docs.forEach((d) => {
    batch.update(d.ref, { comprasRealizadas: 0, recompensaDisponible: false, ticketsSorteo: 0 });
    count++;
    if (count === 499) {
      batches.push(batch);
      batch = writeBatch(db);
      count = 0;
    }
  });
  if (count > 0) batches.push(batch);
  for (const b of batches) await b.commit();
  processed = snap.docs.length;
  return processed;
}

// ── Generar backup completo como Excel ─────────────────────────────────────

async function generarBackupExcel(timestamp: string): Promise<void> {
  // Hoja 1: Sellos
  const logsSnap = await getDocs(collection(db, "system_logs"));
  const sellosRows = logsSnap.docs.map((d) => {
    const data = d.data();
    const dt = parseFecha(data.fecha);
    return {
      ID: d.id,
      Fecha: fmtFecha(dt),
      Hora: dt ? dt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "",
      Cliente: data.usuario || "",
      UsuarioID: data.usuarioId || "",
      VendedorID: data.vendedorId || "",
      Acción: data.accion || "",
      Tipo: data.tipo || "",
      Monto: data.monto || 0,
      Método: data.metodo || "",
    };
  });

  // Hoja 2: Usuarios
  const usuariosSnap = await getDocs(collection(db, "usuarios"));
  const usuariosRows = usuariosSnap.docs.map((d) => {
    const data = d.data();
    return {
      ID: d.id,
      Nombre: data.nombre || "",
      Email: data.email || data.correo || "",
      Teléfono: data.telefono || "",
      Rol: data.rol || "cliente",
      Sellos: data.comprasRealizadas || 0,
      "Fecha Nacimiento": fmtFecha(parseFecha(data.fechaNacimiento)),
      "Fecha Registro": fmtFecha(parseFecha(data.createdAt)),
      Baneado: data.baneado ? "Sí" : "No",
    };
  });

  // Hoja 3: Canjes
  let canjesRows: any[] = [];
  try {
    const canjesSnap = await getDocs(collection(db, "canjes_activos"));
    canjesRows = canjesSnap.docs.map((d) => {
      const data = d.data();
      return {
        ID: d.id,
        UsuarioID: data.userId || "",
        Usuario: data.usuarioNombre || "",
        Premio: data.premioNombre || "",
        Voucher: data.codigoVoucher || "",
        Estado: data.estado || "",
        "Fecha Emisión": fmtFecha(parseFecha(data.fechaEmision)),
        "Fecha Expiración": fmtFecha(parseFecha(data.fechaExpiracion)),
      };
    });
  } catch { /* colección puede no existir */ }

  // Hoja 4: Resumen KPIs
  const sellosConfirmados = logsSnap.docs.filter(d => d.data().tipo === "FIDELIZACION").length;
  const sellosRechazados = logsSnap.docs.filter(d => d.data().tipo === "SELLO_RECHAZADO").length;
  const totalVentas = logsSnap.docs.reduce((s, d) => s + (d.data().monto || 0), 0);
  const resumenRows = [
    { KPI: "Total usuarios registrados", Valor: usuariosSnap.size },
    { KPI: "Total sellos confirmados", Valor: sellosConfirmados },
    { KPI: "Total sellos rechazados", Valor: sellosRechazados },
    { KPI: "Total canjes realizados", Valor: canjesRows.length },
    { KPI: "Monto total registrado (CLP)", Valor: totalVentas },
    { KPI: "Fecha del backup", Valor: timestamp },
  ];

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const wsSellos = XLSX.utils.json_to_sheet(sellosRows);
  wsSellos["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSellos, "Sellos");

  const wsUsuarios = XLSX.utils.json_to_sheet(usuariosRows);
  wsUsuarios["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsUsuarios, "Usuarios");

  if (canjesRows.length > 0) {
    const wsCanjes = XLSX.utils.json_to_sheet(canjesRows);
    wsCanjes["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsCanjes, "Canjes");
  }

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  wsResumen["!cols"] = [{ wch: 36 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  XLSX.writeFile(wb, `auditoria_patiocurauma_${timestamp.replace(/[:.]/g, "-")}.xlsx`);
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function ModeradorAuditoriaPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Limpieza
  const [showModal, setShowModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [limpiandoDB, setLimpiandoDB] = useState(false);
  const [limpiezaStatus, setLimpiezaStatus] = useState<string[]>([]);

  // Exportar auditoría
  const [exportando, setExportando] = useState(false);

  // Stats rápidos
  const [stats, setStats] = useState<{
    sellos: number; usuarios: number; canjes: number; pendientes: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/"); setAuthLoading(false); return; }
      if (user.email === MASTER_EMAIL) { setAuthorized(true); setAuthLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        const rol = snap.exists() ? (snap.data().rol as string) : "";
        if (["moderador", "admin", "director", "director_patio"].includes(rol)) {
          setAuthorized(true);
        } else { router.replace("/"); }
      } catch { router.replace("/"); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Cargar stats ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authorized) return;
    setLoadingStats(true);
    Promise.all([
      getDocs(query(collection(db, "system_logs"), limit(1000))),
      getDocs(collection(db, "usuarios")),
      getDocs(collection(db, "canjes_activos")).catch(() => ({ size: 0 })),
      getDocs(query(collection(db, "pending_stamps"), limit(200))).catch(() => ({ size: 0 })),
    ]).then(([logs, usuarios, canjes, pending]) => {
      setStats({
        sellos: logs.size,
        usuarios: usuarios.size,
        canjes: canjes.size,
        pendientes: pending.size,
      });
    }).finally(() => setLoadingStats(false));
  }, [authorized]);

  // ── Limpiar base de datos ───────────────────────────────────────────────
  const ejecutarLimpieza = async () => {
    if (confirmInput !== CONFIRM_WORD) return;
    setLimpiandoDB(true);
    setLimpiezaStatus([]);

    const log = (msg: string) => setLimpiezaStatus((prev) => [...prev, msg]);

    try {
      const timestamp = new Date().toISOString();
      log("Generando backup completo antes de limpiar...");
      await generarBackupExcel(timestamp);
      log("✓ Backup descargado");

      log("Eliminando pending_stamps...");
      const ps = await deleteCollection("pending_stamps");
      log(`✓ ${ps} pending stamps eliminados`);

      log("Eliminando system_logs...");
      const sl = await deleteCollection("system_logs");
      log(`✓ ${sl} logs eliminados`);

      log("Eliminando canjes...");
      try {
        const ca = await deleteCollection("canjes_activos");
        log(`✓ ${ca} canjes eliminados`);
      } catch { log("ℹ No hay colección de canjes o sin permiso"); }

      log("Reseteando sellos de usuarios a 0...");
      const ru = await resetUserStamps();
      log(`✓ ${ru} usuarios reseteados`);

      setShowModal(false);
      toast({
        title: "Base de datos limpiada",
        description: "Lista para marcha blanca. El backup fue descargado automáticamente.",
      });

      // Refrescar stats
      setStats({ sellos: 0, usuarios: stats?.usuarios ?? 0, canjes: 0, pendientes: 0 });
    } catch (err: any) {
      log(`ERROR: ${err?.message || "Fallo desconocido"}`);
      toast({
        variant: "destructive",
        title: "Error durante la limpieza",
        description: "Revisa el log para más detalles. El backup ya fue descargado.",
      });
    } finally {
      setLimpiandoDB(false);
    }
  };

  // ── Exportar auditoría completa ─────────────────────────────────────────
  const exportarAuditoria = async () => {
    setExportando(true);
    try {
      const timestamp = new Date().toISOString();
      await generarBackupExcel(timestamp);
      toast({ title: "Auditoría exportada", description: "El archivo Excel fue descargado." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al exportar",
        description: err?.message || "Error desconocido",
      });
    } finally {
      setExportando(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/moderador">
            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Auditoría del Sistema
            </h1>
            <p className="text-sm text-slate-400 font-medium">Gestión avanzada de datos</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loadingStats ? (
            <div className="col-span-4 flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#D3B673" }} />
            </div>
          ) : (
            <>
              {[
                { label: "Registros de sellos", value: stats?.sellos ?? 0, color: "#D3B673" },
                { label: "Usuarios", value: stats?.usuarios ?? 0, color: "#6366f1" },
                { label: "Canjes activos", value: stats?.canjes ?? 0, color: "#10b981" },
                { label: "Stamps pendientes", value: stats?.pendientes ?? 0, color: "#f59e0b" },
              ].map(({ label, value, color }) => (
                <Card key={label} className="border-none shadow-md rounded-3xl bg-white">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                    <p className="text-3xl font-black" style={{ color }}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        {/* Sección: Exportar auditoría completa */}
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
          <CardHeader className="px-8 pt-8 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-slate-800">
                  Exportar auditoría completa
                </CardTitle>
                <p className="text-sm text-slate-400 font-medium mt-0.5">
                  Excel con 4 hojas: Sellos · Usuarios · Canjes · Resumen KPIs
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="bg-blue-50 rounded-2xl p-4 mb-5 text-sm text-blue-700 font-medium">
              Genera un Excel con todos los datos del sistema para análisis externo o respaldo manual.
              El archivo incluye timestamps y no modifica ningún dato.
            </div>
            <Button
              onClick={exportarAuditoria}
              disabled={exportando}
              className="rounded-2xl h-11 px-6 gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {exportando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exportando ? "Generando..." : "Exportar auditoría completa"}
            </Button>
          </CardContent>
        </Card>

        {/* Sección: Limpieza para marcha blanca */}
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border-2 border-red-100">
          <CardHeader className="px-8 pt-8 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <Database className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-red-700">
                  Limpiar base de datos para marcha blanca
                </CardTitle>
                <p className="text-sm text-slate-400 font-medium mt-0.5">
                  Elimina datos de prueba · Conserva usuarios y locales
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-4">
            <div className="bg-red-50 rounded-2xl p-4 space-y-2 text-sm">
              <p className="font-black text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Qué se elimina:
              </p>
              <ul className="list-disc list-inside text-red-600 space-y-1 font-medium">
                <li>Todos los documentos de <code className="bg-red-100 px-1 rounded">pending_stamps</code></li>
                <li>Todos los documentos de <code className="bg-red-100 px-1 rounded">system_logs</code></li>
                <li>Todos los documentos de <code className="bg-red-100 px-1 rounded">canjes_activos</code></li>
                <li>Campo <code className="bg-red-100 px-1 rounded">comprasRealizadas</code> y <code className="bg-red-100 px-1 rounded">ticketsSorteo</code> de cada usuario (reset a 0)</li>
              </ul>
              <p className="font-black text-emerald-700 flex items-center gap-2 mt-3">
                <ShieldCheck className="w-4 h-4" /> Qué NO se elimina:
              </p>
              <ul className="list-disc list-inside text-emerald-600 space-y-1 font-medium">
                <li>Perfiles de usuarios (nombre, email, teléfono...)</li>
                <li>Documentos de vendedores/locales</li>
                <li>Configuración de beneficios y premios</li>
                <li>Reglas de Firestore</li>
              </ul>
              <p className="text-slate-500 font-medium mt-3">
                Se genera un <strong>backup Excel automático</strong> antes de eliminar cualquier dato.
              </p>
            </div>
            <Button
              onClick={() => { setShowModal(true); setConfirmInput(""); setLimpiezaStatus([]); }}
              variant="outline"
              className="rounded-2xl h-11 px-6 gap-2 font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar base de datos
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modal de confirmación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">Confirmar limpieza</h2>
                <p className="text-sm text-slate-400 font-medium">Esta acción NO se puede deshacer</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 font-medium leading-relaxed">
              ⚠️ ATENCIÓN: Esta acción eliminará TODOS los sellos, canjes y registros de prueba.
              Los usuarios y locales se mantendrán. Esta acción NO se puede deshacer.
              <br /><br />
              Se descargará un backup Excel automáticamente antes de eliminar.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Escribe <span className="text-red-600">CONFIRMAR</span> para proceder:
              </label>
              <Input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="CONFIRMAR"
                className={`rounded-2xl font-bold text-center tracking-wider h-12 ${
                  confirmInput === CONFIRM_WORD
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-200"
                }`}
              />
            </div>

            {/* Log de limpieza */}
            {limpiezaStatus.length > 0 && (
              <div className="bg-slate-900 rounded-2xl p-4 max-h-40 overflow-y-auto">
                {limpiezaStatus.map((msg, i) => (
                  <p key={i} className="text-xs font-mono text-emerald-400">{msg}</p>
                ))}
                {limpiandoDB && (
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                    <span className="text-xs font-mono text-slate-400">Procesando...</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowModal(false); setLimpiezaStatus([]); }}
                disabled={limpiandoDB}
                className="flex-1 rounded-2xl h-11 border-slate-200 font-bold text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={ejecutarLimpieza}
                disabled={confirmInput !== CONFIRM_WORD || limpiandoDB}
                className="flex-1 rounded-2xl h-11 bg-red-600 hover:bg-red-700 text-white font-bold gap-2 disabled:opacity-40"
              >
                {limpiandoDB ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {limpiandoDB ? "Limpiando..." : "Sí, limpiar todo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
