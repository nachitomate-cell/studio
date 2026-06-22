"use client";

import { Loader2, Sparkles, Copy, ExternalLink } from "lucide-react";

/**
 * Tarjeta promocional de bioo.cl — minimalista (estilo Linear/Apple).
 * Presentacional: recibe el estado y los callbacks por props. La lógica de
 * conexión / auto-login (SSO) vive en quien la usa (dashboard del vendedor o
 * el perfil del socio), para mantenerla intacta.
 */
export interface BiooPromoCardProps {
  /** Handle de bioo si el comercio ya tiene página (muestra el preview del link). */
  handle?: string;
  /** URL pública (opcional; si falta se deriva del handle). */
  publicUrl?: string;
  /** Creando la página (CTA sin handle). */
  busy?: boolean;
  /** Abriendo el editor (CTA con handle). */
  opening?: boolean;
  /** Crear/activar la página (cuando aún no hay handle). */
  onCrear: () => void;
  /** Abrir el editor con SSO (cuando ya hay handle). */
  onAbrir: () => void;
  /** Copiar el enlace público (opcional). */
  onCopiar?: (url: string) => void;
  className?: string;
}

export function BiooPromoCard({
  handle,
  publicUrl,
  busy = false,
  opening = false,
  onCrear,
  onAbrir,
  onCopiar,
  className = "",
}: BiooPromoCardProps) {
  const url = publicUrl || (handle ? `https://bioo.cl/${handle}` : "");
  const loading = busy || opening;

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm ring-1 ring-black/5 ${className}`}>
      {/* Título */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-gray-700" />
        <h3 className="text-base font-semibold text-gray-900">Tu sitio web premium</h3>
      </div>

      {/* Subtítulo */}
      <p className="mt-1 text-sm text-gray-500 leading-relaxed">
        Gratis por ser parte de Club Patio. Un solo link para tus redes, WhatsApp y menú.
      </p>

      {/* Vista previa del enlace (solo si ya tiene página) */}
      {handle && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
          <input
            readOnly
            value={`bioo.cl/${handle}`}
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-600 outline-none"
            aria-label="Tu enlace público"
          />
          {onCopiar && (
            <button
              type="button"
              onClick={() => onCopiar(url)}
              aria-label="Copiar enlace"
              className="text-gray-400 transition-colors hover:text-gray-700"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver página"
            className="text-gray-400 transition-colors hover:text-gray-700"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* CTA — sólido oscuro, sin gradientes */}
      <button
        type="button"
        onClick={handle ? onAbrir : onCrear}
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:scale-[0.99] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {handle ? (opening ? "Abriendo…" : "Abrir Editor") : busy ? "Activando…" : "Activar mi Link"}
      </button>
    </div>
  );
}

export default BiooPromoCard;
