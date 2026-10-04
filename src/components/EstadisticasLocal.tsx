"use client";

/**
 * "Tu local en el Club": lo que el directorio y los sellos le generaron al local
 * en los últimos 30 días. Es la base para que el local vea que estar en el Club
 * le trae clientes (y, más adelante, para venderle aparecer destacado).
 * Datos: GET /api/stats/local (ver ese archivo y src/lib/statsLocal.ts).
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Eye, LayoutGrid, MessageCircle, Instagram, MapPin, Stamp, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";

type Respuesta = {
  dias: number;
  desde: string;
  medidoDesde: string | null;
  totales: Record<string, number>;
  serie: Record<string, Record<string, number>>;
};

const fmt = (n: number) => n.toLocaleString("es-CL");

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

export function EstadisticasLocal({ localId }: { localId?: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/stats/local?localId=${encodeURIComponent(localId || user.uid)}&dias=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        setDatos(await res.json());
      } catch {
        setError(true);
      }
    });
    return () => unsub();
  }, [localId]);

  if (error) return null; // sin perfil o sin permisos: no mostramos una tarjeta rota

  if (!datos) {
    return (
      <div className="rounded-3xl bg-white border border-slate-100 p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      </div>
    );
  }

  return <TarjetaEstadisticas datos={datos} />;
}

/** La parte visual, separada de la carga para poder mostrarla con cualquier dato. */
export function TarjetaEstadisticas({ datos }: { datos: Respuesta }) {
  const t = datos.totales;
  const contactos = (t.whatsapp || 0) + (t.contacto || 0);

  // Barras de vistas al perfil de los últimos 14 días
  const ultimos14 = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
    return { key, n: datos.serie[key]?.vista ?? 0 };
  });
  const max = Math.max(1, ...ultimos14.map((d) => d.n));

  const recienEmpieza = !datos.medidoDesde || datos.medidoDesde > datos.desde;

  const tarjetas = [
    // Textos fieles a lo que se mide: se cuenta una vez por sesión (no personas
    // únicas) y un toque en WhatsApp no garantiza que hayan escrito.
    { Icono: Eye, valor: t.vista || 0, texto: "visitas a tu perfil", color: "#C9920A" },
    { Icono: LayoutGrid, valor: t.impresion || 0, texto: "veces apareciste en el directorio", color: "#2E86AB" },
    { Icono: MessageCircle, valor: contactos, texto: "tocaron para contactarte", color: "#25A55F" },
    { Icono: Stamp, valor: t.sellos || 0, texto: `sellos entregados a ${fmt(t.clientes || 0)} clientes`, color: "#8DC63F" },
    { Icono: Instagram, valor: t.instagram || 0, texto: "abrieron tu Instagram", color: "#C2185B" },
    { Icono: MapPin, valor: t.mapa || 0, texto: "pidieron cómo llegar", color: "#5BB8D4" },
  ];

  return (
    <section className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4" style={{ background: "#C9920A" }}>
        <p className="text-white text-[19px] font-black tracking-tight leading-tight">Tu local en el Club</p>
        <p className="text-[12.5px] font-semibold mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
          {recienEmpieza && datos.medidoDesde
            ? `Desde el ${fechaCorta(datos.medidoDesde)}`
            : `Últimos ${datos.dias} días`}
        </p>
        {/* Visitas al perfil por día (sin datos todavía, las barras vacías se veían como un hueco) */}
        {ultimos14.some((d) => d.n > 0) && (
        <div className="flex items-end gap-1 h-12 mt-4" aria-label="Visitas al perfil por día, últimas 2 semanas">
          {ultimos14.map((d) => (
            <div
              key={d.key}
              className="flex-1 rounded-t"
              title={`${fechaCorta(d.key)}: ${d.n}`}
              style={{ height: `${Math.max(6, (d.n / max) * 100)}%`, background: d.n ? "white" : "rgba(255,255,255,0.25)" }}
            />
          ))}
        </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-100">
        {tarjetas.map(({ Icono, valor, texto, color }) => (
          <div key={texto} className="bg-white p-4">
            <Icono className="w-4 h-4" style={{ color }} />
            <p className="text-[24px] font-black leading-none mt-2" style={{ color: "#1A1A1A" }}>{fmt(valor)}</p>
            <p className="text-[11.5px] font-semibold text-slate-500 leading-snug mt-1">{texto}</p>
          </div>
        ))}
      </div>

      {recienEmpieza && (
        <p className="px-5 py-3 text-[11.5px] text-slate-500 leading-snug bg-slate-50">
          {datos.medidoDesde
            ? "Empezamos a medir hace poco: los números van a ir creciendo día a día."
            : "Empezamos a medir hoy. En unos días vas a ver aquí cuánta gente llega a tu local desde el Club."}
        </p>
      )}
    </section>
  );
}
