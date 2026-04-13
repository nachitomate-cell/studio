"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, getDoc, doc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Loader2, ChevronLeft, Download, Search, Users, CalendarDays, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import * as XLSX from "xlsx";

const MASTER_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com";
const ALLOWED_EMAILS = [MASTER_EMAIL, "fgcservicios@gmail.com"];
const PAGE_SIZE = 25;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Usuario {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;      // ISO string o "N/A"
  fechaNacimientoRaw: Date | null;
  fechaRegistro: string;
  fechaRegistroRaw: Date | null;
  totalSellos: number;
  rol: string;
}

function parseFecha(v: unknown): Date | null {
  if (!v) return null;
  if (typeof (v as any).toDate === "function") return (v as any).toDate();
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtFecha(d: Date | null): string {
  if (!d) return "N/A";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function rolColor(rol: string) {
  switch (rol) {
    case "director":
    case "director_patio": return "bg-purple-100 text-purple-700";
    case "moderador":
    case "admin": return "bg-blue-100 text-blue-700";
    case "vendedor":
    case "emprendedor": return "bg-amber-100 text-amber-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

export default function ModeradorUsuariosPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [mesCumple, setMesCumple] = useState("");
  const [nacDesde, setNacDesde] = useState("");
  const [nacHasta, setNacHasta] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/"); setAuthLoading(false); return; }
      if (ALLOWED_EMAILS.includes(user.email ?? "")) { setAuthorized(true); setAuthLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        const rol = snap.exists() ? (snap.data().rol as string) : "";
        if (["moderador", "admin", "director", "director_patio"].includes(rol)) {
          setAuthorized(true);
        } else {
          router.replace("/");
        }
      } catch { router.replace("/"); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Cargar usuarios ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authorized) return;
    setLoading(true);

    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Sin sesión");

        const res = await fetch("/api/admin/usuarios", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const { usuarios: docs } = await res.json();

        const data: Usuario[] = (docs as any[]).map((d) => {
          const nacRaw = parseFecha(d.fechaNacimiento?._seconds
            ? new Date(d.fechaNacimiento._seconds * 1000).toISOString()
            : d.fechaNacimiento);
          const regRaw = parseFecha(
            d.createdAt?._seconds ? new Date(d.createdAt._seconds * 1000).toISOString()
            : d.fechaRegistro?._seconds ? new Date(d.fechaRegistro._seconds * 1000).toISOString()
            : d.createdAt || d.fechaRegistro || d.lastUpdate
          );
          return {
            id: d.id,
            nombre: d.nombre || d.correo || "Sin nombre",
            telefono: d.telefono || d.phone || "—",
            email: d.email || d.correo || "—",
            fechaNacimiento: fmtFecha(nacRaw),
            fechaNacimientoRaw: nacRaw,
            fechaRegistro: fmtFecha(regRaw),
            fechaRegistroRaw: regRaw,
            totalSellos: d.comprasRealizadas || 0,
            rol: d.rol || "cliente",
          };
        });
        data.sort((a, b) => a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase()));
        setUsuarios(data);
      } catch (err) {
        console.error("Error al cargar usuarios:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [authorized]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return usuarios.filter((u) => {
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!u.nombre.toLowerCase().includes(q) && !u.telefono.includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      if (mesCumple) {
        if (!u.fechaNacimientoRaw) return false;
        if (u.fechaNacimientoRaw.getMonth() !== parseInt(mesCumple)) return false;
      }
      if (nacDesde && u.fechaNacimientoRaw) {
        if (u.fechaNacimientoRaw < new Date(nacDesde)) return false;
      }
      if (nacHasta && u.fechaNacimientoRaw) {
        if (u.fechaNacimientoRaw > new Date(nacHasta + "T23:59:59")) return false;
      }
      return true;
    });
  }, [usuarios, busqueda, mesCumple, nacDesde, nacHasta]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hayFiltros = busqueda || mesCumple || nacDesde || nacHasta;

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const exportExcel = () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const rows = filtered.map((u) => ({
      Nombre: u.nombre,
      Teléfono: u.telefono,
      Email: u.email,
      "Fecha Nacimiento": u.fechaNacimiento,
      "Fecha Registro": u.fechaRegistro,
      "Total Sellos": u.totalSellos,
      Rol: u.rol,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 18 },
      { wch: 18 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, `usuarios_patiocurauma_${hoy}.xlsx`);
  };

  const resetFiltros = () => {
    setBusqueda(""); setMesCumple(""); setNacDesde(""); setNacHasta(""); setCurrentPage(1);
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/moderador">
            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Directorio de Usuarios
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              {loading ? "Cargando..." : `${usuarios.length} usuarios registrados`}
            </p>
          </div>
          <Button
            onClick={exportExcel}
            variant="outline"
            className="rounded-2xl h-10 px-4 gap-2 font-bold text-sm border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* KPI rápido */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total usuarios", value: usuarios.length, color: "#D3B673" },
            { label: "Clientes", value: usuarios.filter(u => u.rol === "cliente" || !u.rol).length, color: "#6366f1" },
            { label: "Con cumpleaños", value: usuarios.filter(u => u.fechaNacimientoRaw).length, color: "#f59e0b" },
            { label: "Resultado filtro", value: filtered.length, color: "#10b981" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-none shadow-md rounded-3xl bg-white">
              <CardContent className="p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                <p className="text-3xl font-black" style={{ color }}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-3xl shadow-md p-5 space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Filtros</p>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Buscador */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Buscar por nombre, teléfono o email
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setCurrentPage(1); }}
                  className="pl-9 h-10 rounded-xl border-slate-200 text-sm font-medium"
                />
              </div>
            </div>

            {/* Mes de cumpleaños */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Mes de cumpleaños
              </label>
              <select
                value={mesCumple}
                onChange={(e) => { setMesCumple(e.target.value); setCurrentPage(1); }}
                className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Todos los meses</option>
                {MESES.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>

            {/* Rango fecha nacimiento */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nac. desde
              </label>
              <input
                type="date"
                value={nacDesde}
                onChange={(e) => { setNacDesde(e.target.value); setCurrentPage(1); }}
                className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nac. hasta
              </label>
              <input
                type="date"
                value={nacHasta}
                onChange={(e) => { setNacHasta(e.target.value); setCurrentPage(1); }}
                className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {hayFiltros && (
              <Button
                variant="ghost"
                onClick={resetFiltros}
                className="h-10 text-slate-400 hover:text-slate-600 text-xs font-bold rounded-xl"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando usuarios...</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500">
                  {filtered.length} {filtered.length === 1 ? "usuario" : "usuarios"}
                  {hayFiltros ? " con filtros aplicados" : " en total"}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs text-slate-400 uppercase font-black tracking-wider border-b-2 border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Nombre</th>
                      <th className="px-6 py-4">Teléfono</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">F. Nacimiento</th>
                      <th className="px-6 py-4">F. Registro</th>
                      <th className="px-6 py-4">Sellos</th>
                      <th className="px-6 py-4">Rol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center text-slate-300 font-bold">
                          Sin usuarios para los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      paginated.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{u.nombre}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-300" />
                              {u.telefono}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-300" />
                              <span className="truncate max-w-[200px]">{u.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-slate-300" />
                              {u.fechaNacimiento}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-medium whitespace-nowrap text-xs">
                            {u.fechaRegistro}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              {u.totalSellos} sellos
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${rolColor(u.rol)}`}>
                              {u.rol}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-bold">
                    Mostrando {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border-slate-200 text-xs font-bold h-9"
                    >
                      Anterior
                    </Button>
                    <span className="text-xs font-black text-slate-500 px-2 tabular-nums">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border-slate-200 text-xs font-bold h-9"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
