"use client";

/**
 * Tarjeta para activar las notificaciones push.
 *
 * Se usa en el momento de máxima intención: justo después de completar el
 * registro, cuando la persona acaba de anotarse. Antes el registro terminaba
 * redirigiendo a la home sin pedir nunca el permiso, y el único pedido era un
 * banner que aparecía 2 segundos después de entrar — 8% de conversión.
 *
 * Nunca muestra un botón que no pueda funcionar: en iPhone sin la PWA instalada
 * el push es imposible, así que muestra cómo instalarla en vez de un "Activar"
 * muerto. Dentro de Instagram o Facebook tampoco hay push, así que explica cómo
 * abrir el link en Chrome o Safari. Y si el permiso ya fue denegado no insiste,
 * porque el navegador no vuelve a preguntar: dice dónde se desbloquea.
 */

import { useEffect, useState } from "react";
import { Bell, BellRing, Share, Plus, AlertCircle, ExternalLink, Copy, Check } from "lucide-react";
import {
  estadoPush, esIOS, linkAbrirEnNavegador, pasosSalirNavegadorInterno, pasosDesbloquear,
  type EstadoPush,
} from "@/lib/pushSoporte";

const CAJA = "rounded-[20px] px-[18px] py-4 mb-5 text-left";

export function ActivarNotificaciones({
  onListo,
  titulo,
  descripcion,
}: {
  onListo?: () => void;
  /** Título en contexto. Si se omite, se usa el genérico del Club. */
  titulo?: string;
  /** Debe decir qué se pierde si NO las activa: es lo que convence. */
  descripcion?: string;
}) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [cargando, setCargando] = useState(false);
  const [falloTecnico, setFalloTecnico] = useState(false);

  // El estado se resuelve en el cliente: depende de APIs del navegador.
  useEffect(() => { setEstado(estadoPush()); }, []);

  const activar = async () => {
    setCargando(true);
    setFalloTecnico(false);
    try {
      // Import dinámico: el módulo toca APIs que fallan al cargar en Safari.
      const { registerFcmToken } = await import("@/lib/fcmTokenManager");
      const r = await registerFcmToken();
      if (r.ok) {
        setEstado("concedido");
        onListo?.();
      } else if (r.reason === "denied") {
        setEstado("denegado");
      } else if (r.reason === "unsupported") {
        setEstado(estadoPush() === "navegador_interno" ? "navegador_interno" : "requiere_instalacion");
      } else {
        // no_vapid_key / sw_error / token_error: el usuario no puede hacer nada.
        setFalloTecnico(true);
      }
    } catch {
      setFalloTecnico(true);
    } finally {
      setCargando(false);
    }
  };

  // Mientras se resuelve, y cuando no hay nada accionable, no ocupamos espacio.
  if (estado === null || estado === "no_soportado") return null;

  if (estado === "concedido") {
    return (
      <div className={`${CAJA} flex items-center gap-2.5 border border-[#9DCC65]/30 bg-gradient-to-br from-[#9DCC65]/[0.14] to-[#9DCC65]/[0.06]`}>
        <BellRing className="w-5 h-5 shrink-0 text-[#9DCC65]" />
        <p className="m-0 text-[12.5px] font-semibold leading-[1.45] text-slate-300">
          Listo, los avisos están activados. Te llegará una alerta a este
          teléfono si ganas o si tienes un premio para canjear.
        </p>
      </div>
    );
  }

  if (estado === "navegador_interno") return <SalirNavegadorInterno />;

  if (estado === "requiere_instalacion") {
    return (
      <div className={`${CAJA} border border-[#D3B673]/[0.28] bg-white/5`}>
        <div className="flex items-center gap-2 mb-2.5">
          <Bell className="w-[18px] h-[18px] shrink-0 text-[#D3B673]" />
          <p className="m-0 text-[13.5px] font-extrabold text-slate-50">
            Para recibir avisos en iPhone
          </p>
        </div>
        <p className="m-0 mb-2.5 text-[11.5px] leading-normal text-slate-400">
          Primero agrega la app a tu pantalla de inicio. Toma 10 segundos:
        </p>
        <Pasos
          pasos={[
            { icono: <Share className="w-[13px] h-[13px]" />, texto: "Toca Compartir en la barra de Safari" },
            { icono: <Plus className="w-[13px] h-[13px]" />, texto: "Elige “Agregar a pantalla de inicio”" },
            { icono: <BellRing className="w-[13px] h-[13px]" />, texto: "Abre la app desde el ícono nuevo y activa los avisos" },
          ]}
        />
      </div>
    );
  }

  if (estado === "denegado") {
    return (
      <div className={`${CAJA} flex items-start gap-2.5 border border-white/10 bg-white/[0.04]`}>
        <AlertCircle className="w-[18px] h-[18px] shrink-0 mt-px text-slate-400" />
        <div>
          <p className="m-0 mb-1.5 text-[11.5px] leading-normal text-slate-400">
            Los avisos quedaron bloqueados en este teléfono. Para recibirlos:
          </p>
          <p className="m-0 text-[11.5px] font-bold leading-normal text-slate-300">{pasosDesbloquear()}</p>
        </div>
      </div>
    );
  }

  // preguntable
  return (
    <div className={`${CAJA} border border-[#D3B673]/[0.32] bg-gradient-to-br from-[#D3B673]/[0.14] to-[#D3B673]/5`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Bell className="w-[18px] h-[18px] shrink-0 text-[#D3B673]" />
        <p className="m-0 text-sm font-extrabold text-slate-50">
          {titulo ?? "¿Cómo te avisamos si ganas?"}
        </p>
      </div>
      <p className="m-0 mb-3 text-[12.5px] leading-[1.55] text-slate-300">
        {descripcion ??
          "Con los avisos activados te llega una alerta al teléfono apenas tengas " +
          "un premio listo o salgas sorteado. Sin ellos, solo te enteras si entras a la app."}
      </p>
      {falloTecnico && (
        <p className="m-0 mb-2.5 text-[11px] leading-[1.4] text-red-300">
          No se pudo activar en este dispositivo. Puedes intentarlo más tarde
          desde tu perfil.
        </p>
      )}
      <button
        onClick={activar}
        disabled={cargando}
        className={`w-full h-[46px] rounded-[14px] border-none bg-gradient-to-br from-[#D3B673] to-[#C9920A] text-white font-black text-[13.5px] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(201,146,10,0.3)] transition-all hover:opacity-90 active:scale-[0.98] ${cargando ? "cursor-default opacity-[0.65]" : "cursor-pointer"}`}
      >
        <Bell className="w-[15px] h-[15px]" />
        {cargando ? "Activando…" : "Activar avisos en mi teléfono"}
      </button>
    </div>
  );
}

function Pasos({ pasos }: { pasos: { icono: React.ReactNode; texto: string }[] }) {
  return (
    <>
      {pasos.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center bg-[#D3B673]/[0.16] text-[#D3B673]">
            {p.icono}
          </span>
          <p className="m-0 text-[11.5px] leading-[1.4] text-slate-300">{p.texto}</p>
        </div>
      ))}
    </>
  );
}

/**
 * Dentro de Instagram/Facebook: botón para saltar a Chrome (Android) y, como
 * respaldo, copiar el link y los pasos a mano. Se exporta para el perfil.
 */
export function SalirNavegadorInterno({ claro = false }: { claro?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [ios, setIos] = useState(false);
  // Todo lo que depende del teléfono se lee después de montar: el servidor no
  // sabe si es iPhone o Android y el texto no coincidiría al hidratar.
  const [pasos, setPasos] = useState("");

  useEffect(() => {
    setLink(linkAbrirEnNavegador());
    setIos(esIOS());
    setPasos(pasosSalirNavegadorInterno());
  }, []);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Algunos navegadores internos bloquean el portapapeles: queda el texto a la vista.
      window.prompt("Copia este link y pégalo en tu navegador:", window.location.origin);
    }
  };

  const navegador = ios ? "Safari" : "Chrome";

  return (
    <div className={`${CAJA} border ${claro ? "border-amber-200 bg-amber-50" : "border-[#D3B673]/[0.32] bg-white/5"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Bell className="w-[18px] h-[18px] shrink-0 text-[#D3B673]" />
        <p className={`m-0 text-[13.5px] font-extrabold ${claro ? "text-slate-800" : "text-slate-50"}`}>
          Abre la app en {navegador} para recibir avisos
        </p>
      </div>
      <p className={`m-0 mb-3 text-[11.5px] leading-normal ${claro ? "text-slate-600" : "text-slate-400"}`}>
        Estás viendo el Club dentro de Instagram o Facebook, y desde ahí el
        teléfono no deja activar los avisos ni instalar la app. {pasos}
      </p>
      {link && (
        <a
          href={link}
          className="w-full h-11 mb-2 rounded-[14px] bg-gradient-to-br from-[#D3B673] to-[#C9920A] text-white font-black text-[13px] flex items-center justify-center gap-2 no-underline active:scale-[0.98]"
        >
          <ExternalLink className="w-4 h-4" /> Abrir en Chrome
        </a>
      )}
      <button
        onClick={copiar}
        className={`w-full h-10 rounded-[14px] border text-[12.5px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] ${claro ? "border-slate-200 bg-white text-slate-600" : "border-white/15 bg-transparent text-slate-300"}`}
      >
        {copiado ? <><Check className="w-4 h-4" /> Link copiado</> : <><Copy className="w-4 h-4" /> Copiar link</>}
      </button>
    </div>
  );
}
