"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Search, Loader2, ShieldCheck, AlertTriangle, ClipboardList, ArrowLeft } from "lucide-react";
import Link from "next/link";

const MASTER_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com";

interface LogEntry {
  id: string;
  fecha: string;
  usuario: string;
  usuarioId?: string;
  accion: string;
  tipo: string;
  vendedorId?: string;
}

function formatFecha(fechaStr: string): string {
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return fechaStr;
  }
}

function TipoBadge({ tipo }: { tipo: string }) {
  const t = (tipo || "").toUpperCase();

  if (t === "FIDELIZACION") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#9DCC65] text-white">
        {tipo}
      </span>
    );
  }
  if (t === "CANJE") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#6EBBD1] text-white">
        {tipo}
      </span>
    );
  }
  if (t === "NOTIFICACION" || t === "NOTIFICACIÓN") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white">
        {tipo}
      </span>
    );
  }
  if (t === "ERROR" || t === "FRAUDE" || t === "BLOQUEO") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500 text-white">
        {tipo}
      </span>
    );
  }
  // Fallback
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-white">
      {tipo || "—"}
    </span>
  );
}

export default function AdminLogsPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");

  // Guard de acceso
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== MASTER_EMAIL) {
        setAccessDenied(true);
        setLoadingAuth(false);
        setTimeout(() => router.push("/"), 3000);
        return;
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, [router]);

  // Suscripción en tiempo real a system_logs
  useEffect(() => {
    if (loadingAuth || accessDenied) return;

    const q = query(
      collection(db, "system_logs"),
      orderBy("fecha", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data: LogEntry[] = snapshot.docs.map((d) => {
          const raw = d.data();
          // fecha puede ser Timestamp de Firestore o string ISO
          let fechaStr = "";
          if (raw.fecha?.toDate) {
            fechaStr = raw.fecha.toDate().toISOString();
          } else if (typeof raw.fecha === "string") {
            fechaStr = raw.fecha;
          }
          return {
            id: d.id,
            fecha: fechaStr,
            usuario: raw.usuario || raw.usuarioNombre || "—",
            usuarioId: raw.usuarioId || "",
            accion: raw.accion || "—",
            tipo: raw.tipo || "—",
            vendedorId: raw.vendedorId || "",
          };
        });
        setLogs(data);
        setLoadingLogs(false);
      },
      (error) => {
        console.warn("[admin-logs] Error al leer system_logs:", error);
        setLoadingLogs(false);
      }
    );

    return () => unsub();
  }, [loadingAuth, accessDenied]);

  // Filtrado local por usuario o vendedorId
  const filtered = useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(
      (l) =>
        l.usuario.toLowerCase().includes(q) ||
        (l.vendedorId || "").toLowerCase().includes(q) ||
        (l.usuarioId || "").toLowerCase().includes(q)
    );
  }, [logs, filter]);

  // ── Estados de carga / acceso ──────────────────────────────────────────────
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#9DCC65]" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Verificando acceso...
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-6">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-black text-slate-800">Acceso Denegado</h2>
          <p className="text-sm text-slate-500 font-medium">
            Solo el Master Admin puede ver los registros de auditoría.
          </p>
          <p className="text-xs text-slate-300">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  // ── Vista principal ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-24">
      <div className="max-w-7xl mx-auto px-4 md:px-10 py-10 space-y-8">

        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/moderador"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#9DCC65] transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al Panel
            </Link>
            <h1
              className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3"
              style={{ color: "#4A4A4A" }}
            >
              <ClipboardList className="w-8 h-8 text-[#9DCC65] shrink-0" />
              Auditoría del Sistema
            </h1>
            <p className="text-sm font-medium text-slate-400">
              Registro en tiempo real de todos los eventos de{" "}
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                system_logs
              </code>
            </p>
          </div>

          {/* Contador */}
          <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl px-5 py-3 shadow-sm self-start">
            <ShieldCheck className="w-4 h-4 text-[#9DCC65]" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {filtered.length}{" "}
              <span className="font-black text-slate-700">
                {filtered.length === 1 ? "registro" : "registros"}
              </span>
            </span>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filtrar por usuario o vendedor..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-11 pr-4 h-12 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm text-[#4A4A4A] placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#9DCC65]/40 focus:border-[#9DCC65] transition"
          />
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {loadingLogs ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#9DCC65]" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Cargando registros...
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                {/* Cabeceras */}
                <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-100">
                  <tr>
                    {["Fecha", "Usuario", "Acción", "Tipo", "Vendedor"].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Filas */}
                <tbody className="divide-y divide-slate-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <ClipboardList className="w-10 h-10 text-slate-200" />
                          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                            {filter ? "Sin resultados para ese filtro" : "No hay registros aún"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 transition-colors border-b border-slate-50"
                      >
                        {/* Fecha */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-500 tabular-nums">
                            {formatFecha(log.fecha)}
                          </span>
                        </td>

                        {/* Usuario */}
                        <td className="px-6 py-4">
                          <span
                            className="font-bold text-sm"
                            style={{ color: "#4A4A4A" }}
                          >
                            {log.usuario}
                          </span>
                          {log.usuarioId && (
                            <p className="text-[10px] text-slate-300 font-mono mt-0.5 truncate max-w-[140px]">
                              {log.usuarioId}
                            </p>
                          )}
                        </td>

                        {/* Acción */}
                        <td className="px-6 py-4 max-w-[260px]">
                          <span className="text-xs font-medium text-slate-500 leading-snug">
                            {log.accion}
                          </span>
                        </td>

                        {/* Tipo (badge) */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <TipoBadge tipo={log.tipo} />
                        </td>

                        {/* Vendedor */}
                        <td className="px-6 py-4">
                          {log.vendedorId ? (
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                              {log.vendedorId}
                            </span>
                          ) : (
                            <span className="text-slate-200 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-300 font-medium">
          Los datos se actualizan en tiempo real · Master Admin only
        </p>
      </div>
    </main>
  );
}
