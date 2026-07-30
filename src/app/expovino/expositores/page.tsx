"use client";

/**
 * Directorio de expositores de Expovino, pensado para usarse dentro de la feria:
 * buscar rápido, filtrar por tipo y ver el plano del recinto.
 *
 * A diferencia de /ruta-bac no hay sellos ni geolocalización: los expositores no
 * son locales del Club, no tienen cuenta ni QR. Es un catálogo de consulta.
 *
 * El plano se sirve como imagen desde /public. Si el archivo no está, la sección
 * se oculta sola en vez de mostrar una imagen rota.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPOSITORES, urlBusqueda, type TipoExpositor } from "@/lib/expositoresExpovino";
import { CAMPANAS } from "@/lib/campanas";
import { ArrowLeft, Search, ExternalLink, Wine, UtensilsCrossed, Map as MapIcon, X } from "lucide-react";

const CAMPANA = CAMPANAS.expovino;
const RUTA_PLANO = "/expovino-plano.jpg";

type Filtro = "todos" | TipoExpositor;

/** Sin acentos ni mayúsculas: buscar "vina" tiene que encontrar "VIÑA". */
const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function ExpositoresPage() {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [planoAbierto, setPlanoAbierto] = useState(false);
  const [hayPlano, setHayPlano] = useState(true);

  const totales = useMemo(() => ({
    todos: EXPOSITORES.length,
    vina: EXPOSITORES.filter((e) => e.tipo === "vina").length,
    gastronomia: EXPOSITORES.filter((e) => e.tipo === "gastronomia").length,
  }), []);

  const listado = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return EXPOSITORES
      .filter((e) => filtro === "todos" || e.tipo === filtro)
      .filter((e) => !q || normalizar(e.nombre).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [busqueda, filtro]);

  const pestanas: { id: Filtro; texto: string; n: number }[] = [
    { id: "todos", texto: "Todos", n: totales.todos },
    { id: "vina", texto: "Viñas", n: totales.vina },
    { id: "gastronomia", texto: "Gastronomía", n: totales.gastronomia },
  ];

  return (
    <main className="min-h-screen pb-16" style={{ background: "linear-gradient(180deg,#12060B 0%,#1E0912 60%,#12060B 100%)" }}>

      {/* Cabecera + buscador, fijos: en la feria se navega con una mano */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: "rgba(18,6,11,0.95)", backdropFilter: "blur(8px)" }}>
        <div className="mx-auto w-full max-w-lg">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.back()} aria-label="Volver"
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.08)" }}>
              <ArrowLeft className="w-4 h-4" style={{ color: CAMPANA.colorTexto }} />
            </button>
            <div className="min-w-0">
              <h1 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.2 }}>
                Expositores {CAMPANA.emoji}
              </h1>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                {totales.vina} viñas y {totales.gastronomia} restaurantes
              </p>
            </div>
            {hayPlano && (
              <button onClick={() => setPlanoAbierto(true)}
                className="ml-auto shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-full"
                style={{ background: CAMPANA.colorPrimario, color: CAMPANA.colorTexto, fontSize: 12, fontWeight: 800 }}>
                <MapIcon className="w-3.5 h-3.5" /> Plano
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar viña o restaurante…"
              className="w-full h-11 rounded-2xl pl-10 pr-9 outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 14 }}
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} aria-label="Limpiar"
                className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4" style={{ color: "#64748b" }} />
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            {pestanas.map((p) => {
              const activa = filtro === p.id;
              return (
                <button key={p.id} onClick={() => setFiltro(p.id)}
                  className="flex-1 h-9 rounded-xl transition-colors"
                  style={{
                    background: activa ? CAMPANA.colorPrimario : "rgba(255,255,255,0.06)",
                    color: activa ? CAMPANA.colorTexto : "#94a3b8",
                    fontSize: 12, fontWeight: 800,
                    border: `1px solid ${activa ? CAMPANA.colorPrimario : "rgba(255,255,255,0.1)"}`,
                  }}>
                  {p.texto} · {p.n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Listado */}
      <div className="px-4 mt-2">
        <div className="mx-auto w-full max-w-lg flex flex-col gap-2">
          {listado.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "32px 0" }}>
              No hay expositores que coincidan con “{busqueda}”.
            </p>
          ) : (
            listado.map((e) => (
              <a
                key={e.nombre}
                href={urlBusqueda(e)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 rounded-2xl transition-transform active:scale-[0.99]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: e.tipo === "vina" ? "rgba(123,30,58,0.4)" : "rgba(157,204,101,0.18)" }}
                >
                  {e.tipo === "vina"
                    ? <Wine className="w-4 h-4" style={{ color: "#E9AFC0" }} />
                    : <UtensilsCrossed className="w-4 h-4" style={{ color: "#9DCC65" }} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                    {e.nombre}
                  </p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                    {e.tipo === "vina" ? "Viña" : "Gastronomía"}
                    {e.contacto ? ` · ${e.contacto}` : ""}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748b" }} />
              </a>
            ))
          )}
        </div>
      </div>

      {/* Plano del recinto a pantalla completa */}
      {planoAbierto && hayPlano && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(5,2,4,0.97)" }}
          onClick={() => setPlanoAbierto(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <p style={{ fontSize: 14, fontWeight: 900, color: "#fff", margin: 0 }}>Plano del recinto</p>
            <button onClick={() => setPlanoAbierto(false)} aria-label="Cerrar"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <X className="w-4 h-4" style={{ color: "#fff" }} />
            </button>
          </div>
          {/* overflow-auto permite acercar con los dedos y desplazarse */}
          <div className="flex-1 overflow-auto p-3" onClick={(ev) => ev.stopPropagation()}>
            <img
              src={RUTA_PLANO}
              alt="Plano de Expovino"
              onError={() => { setHayPlano(false); setPlanoAbierto(false); }}
              style={{ width: "100%", minWidth: 620, height: "auto", borderRadius: 12 }}
            />
          </div>
          <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", padding: "8px 16px 16px" }}>
            Acerca con los dedos para ver los stands
          </p>
        </div>
      )}
    </main>
  );
}
