"use client";

/**
 * Activar el aviso de llegada al Patio (solo app de las tiendas).
 *
 * POLÍTICA DE GOOGLE PLAY: antes de pedir la ubicación en segundo plano hay que
 * mostrar DENTRO de la app una explicación visible que diga qué dato se usa
 * (ubicación), que se usa con la app cerrada y para qué. Esa explicación es
 * `TEXTO_DIVULGACION` y aparece SIEMPRE antes del diálogo del sistema. No
 * acortarla ni moverla a un "más info": la revisión de Play la busca en el video.
 *
 * Orden de los pedidos: avisos → ubicación mientras se usa → "todo el tiempo".
 * Ni Android (11+) ni iOS dejan ofrecer "todo el tiempo"/"Siempre" en la
 * primera pregunta. Por eso, apenas dan la ubicación mientras se usa, se abre
 * la GUÍA a pantalla completa: muestra la pantalla que viene con la opción
 * marcada, pide el permiso y, al volver, dice si quedó o qué falta.
 *  - Android: el sistema abre la pantalla "Permiso de Ubicación". Después de
 *    dos "no", Android deja de mostrarla: ahí la guía manda a los Ajustes.
 *  - iOS: "Cambiar a Permitir siempre" aparece UNA sola vez y la app no puede
 *    saber si ya salió, por eso se recuerda en el teléfono (CLAVE_SIEMPRE_IOS).
 *    Con "Al usar la app" el aviso igual funciona.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, BellRing, Settings, X, CheckCircle2, ArrowLeft } from "lucide-react";
import { esAppNativa } from "@/lib/nativo";
import type { EstadoGeoPush } from "@/lib/geopush";

export const TEXTO_DIVULGACION =
  "Club Patio usa tu ubicación para avisarte cuando llegas a Patio Curauma, " +
  "incluso cuando la app está cerrada o no la estás usando. Solo se usa para " +
  "detectar tu llegada a las zonas del Patio: tu recorrido no se guarda ni se comparte.";

const CLAVE_POSPUESTO = "geopush_pospuesto_hasta";
const DIAS_POSPUESTO = 7;
const CLAVE_SIEMPRE_IOS = "geopush_siempre_ios_pedido";

type Paso = "inicio" | "segundo_plano" | "bloqueado";

export function siemprePedidoIOS(): boolean {
  try {
    return localStorage.getItem(CLAVE_SIEMPRE_IOS) === "1";
  } catch {
    return false;
  }
}

export function useGeoPushEstado() {
  const [estado, setEstado] = useState<EstadoGeoPush | null>(null);
  const [disponible, setDisponible] = useState(false);

  const refrescar = useCallback(async () => {
    const { geoPushDisponible, GeoPush } = await import("@/lib/geopush");
    if (!geoPushDisponible()) return;
    setDisponible(true);
    try {
      setEstado(await GeoPush.estado());
    } catch {}
  }, []);

  useEffect(() => {
    if (!esAppNativa()) return;
    refrescar();
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [refrescar]);

  return { estado, setEstado, disponible, refrescar };
}

/** ¿Qué falta? null = nada (ya avisa). */
export function pasoPendiente(e: EstadoGeoPush | null): Paso | null {
  if (!e) return null;
  if (e.ubicacion === "denied") return "bloqueado";
  if (e.ubicacion !== "granted") return "inicio";
  if (e.avisos !== "granted") return e.avisos === "denied" ? "bloqueado" : "inicio";
  // iOS con "Al usar la app" ya avisa; "Siempre" se ofrece una vez (iOS no lo muestra dos).
  if (e.plataforma === "ios") return e.modo === "mientras_se_usa" && !siemprePedidoIOS() ? "segundo_plano" : null;
  if (e.segundoPlano !== "granted") return "segundo_plano";
  return null;
}

/** Ejecuta los pedidos del paso. Devuelve el estado final. */
export async function activarGeoPush(paso: Paso): Promise<EstadoGeoPush | null> {
  const { GeoPush, sincronizarGeoPush } = await import("@/lib/geopush");
  const { auth } = await import("@/lib/firebase");
  if (paso === "bloqueado") {
    await GeoPush.abrirAjustes();
    return null;
  }
  if (paso === "inicio") {
    // El permiso de avisos es el mismo que usa el push del Club: se registra el token de una vez.
    try {
      const { registerFcmToken } = await import("@/lib/fcmTokenManager");
      await registerFcmToken();
    } catch {}
    let e = await GeoPush.pedirPermiso({ paso: "avisos" });
    if (e.ubicacion !== "granted") e = await GeoPush.pedirPermiso({ paso: "ubicacion" });
    await sincronizarGeoPush(auth.currentUser);
    return GeoPush.estado();
  }
  const e = await GeoPush.pedirPermiso({ paso: "segundoPlano" });
  if (e.plataforma === "ios") {
    try {
      localStorage.setItem(CLAVE_SIEMPRE_IOS, "1");
    } catch {}
  }
  await sincronizarGeoPush(auth.currentUser);
  return GeoPush.estado();
}

// ── Flujo con guía ───────────────────────────────────────────────────────────

type Fase = "guia" | "esperando_ajustes" | "listo" | "falta";

/**
 * Activa paso a paso y, cuando toca "todo el tiempo"/"Siempre", abre la guía.
 * `alCambiar` recibe el estado nuevo (o null si hay que volver a leerlo).
 */
export function useFlujoGeoPush(alCambiar: (e: EstadoGeoPush | null) => void) {
  const [fase, setFase] = useState<Fase | null>(null);
  const [plataforma, setPlataforma] = useState<"android" | "ios">("android");
  /** Android ya dijo "no" dos veces: el sistema no vuelve a mostrar la pantalla, va por Ajustes. */
  const [porAjustes, setPorAjustes] = useState(false);
  const [cargando, setCargando] = useState(false);

  const abrirGuia = useCallback((e: EstadoGeoPush) => {
    setPlataforma(e.plataforma);
    setPorAjustes(e.plataforma === "android" && e.segundoPlano === "denied");
    setFase("guia");
  }, []);

  const resolver = useCallback(
    (e: EstadoGeoPush | null) => {
      alCambiar(e);
      if (!e) return setFase("falta");
      if (e.plataforma === "ios") {
        if (e.activo || e.segundoPlano === "granted") return setFase("listo");
        // Con iOS solo puede faltar otro permiso (notificaciones o ubicación apagada): a Ajustes.
        setPorAjustes(true);
        return setFase("falta");
      }
      if (e.segundoPlano === "granted") return setFase("listo");
      setPorAjustes(e.segundoPlano === "denied");
      setFase("falta");
    },
    [alCambiar],
  );

  const activar = async (paso: Paso, estado: EstadoGeoPush | null) => {
    if (paso === "segundo_plano" && estado) return abrirGuia(estado);
    setCargando(true);
    try {
      const e = await activarGeoPush(paso);
      alCambiar(e);
      // Sin volver a la tarjeta: si dio la ubicación, sigue directo al último paso.
      if (e && paso === "inicio" && pasoPendiente(e) === "segundo_plano") abrirGuia(e);
    } catch {
      alCambiar(null);
    } finally {
      setCargando(false);
    }
  };

  const continuar = async () => {
    const { GeoPush } = await import("@/lib/geopush");
    if (porAjustes) {
      setFase("esperando_ajustes");
      await GeoPush.abrirAjustes();
      return;
    }
    setCargando(true);
    try {
      resolver(await activarGeoPush("segundo_plano"));
    } catch {
      resolver(null);
    } finally {
      setCargando(false);
    }
  };

  // Volvió de Ajustes: leer cómo quedó y registrar las zonas si ya hay permiso.
  useEffect(() => {
    if (fase !== "esperando_ajustes") return;
    const alVolver = async () => {
      if (document.visibilityState !== "visible") return;
      const { GeoPush, sincronizarGeoPush } = await import("@/lib/geopush");
      const { auth } = await import("@/lib/firebase");
      try {
        await sincronizarGeoPush(auth.currentUser);
        resolver(await GeoPush.estado());
      } catch {
        resolver(null);
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [fase, resolver]);

  const guia =
    fase && typeof document !== "undefined"
      ? createPortal(
          <GeoPushGuia
            fase={fase}
            plataforma={plataforma}
            porAjustes={porAjustes}
            cargando={cargando}
            onContinuar={continuar}
            onReintentar={() => setFase("guia")}
            onCerrar={() => setFase(null)}
          />,
          document.body,
        )
      : null;

  return { activar, cargando, guia };
}

/**
 * Tarjeta de la home. Se esconde sola si ya está activo, si no es la app
 * nativa o si la persona dijo "Ahora no" hace menos de una semana.
 */
export function GeoPushTarjeta() {
  const { estado, setEstado, disponible, refrescar } = useGeoPushEstado();
  const [pospuesto, setPospuesto] = useState(true);
  const alCambiar = useCallback((e: EstadoGeoPush | null) => (e ? setEstado(e) : void refrescar()), [setEstado, refrescar]);
  const { activar, cargando, guia } = useFlujoGeoPush(alCambiar);

  useEffect(() => {
    try {
      const hasta = Number(localStorage.getItem(CLAVE_POSPUESTO) || 0);
      setPospuesto(Date.now() < hasta);
    } catch {
      setPospuesto(false);
    }
  }, []);

  const paso = pasoPendiente(estado);
  const mostrarTarjeta = disponible && !!estado && !!paso && !pospuesto && !!estado.zonas;

  const posponer = () => {
    try {
      localStorage.setItem(CLAVE_POSPUESTO, String(Date.now() + DIAS_POSPUESTO * 86_400_000));
    } catch {}
    setPospuesto(true);
  };

  return (
    <>
      {mostrarTarjeta && (
        <GeoPushCaja
          paso={paso!}
          cargando={cargando}
          onActivar={() => activar(paso!, estado)}
          onCerrar={posponer}
          plataforma={estado!.plataforma}
        />
      )}
      {guia}
    </>
  );
}

export function GeoPushCaja({
  paso,
  cargando,
  onActivar,
  onCerrar,
  plataforma,
}: {
  paso: Paso;
  cargando: boolean;
  onActivar: () => void;
  onCerrar?: () => void;
  plataforma: "android" | "ios";
}) {
  const titulo =
    paso === "segundo_plano" ? "Un paso más para el aviso" :
    paso === "bloqueado" ? "Los avisos de llegada están bloqueados" :
    "Te avisamos cuando llegues al Patio";

  const boton =
    paso === "segundo_plano" ? (plataforma === "ios" ? "Elegir “Permitir siempre”" : "Elegir “Permitir todo el tiempo”") :
    paso === "bloqueado" ? "Abrir ajustes de Club Patio" :
    "Activar aviso de llegada";

  return (
    <div className="relative rounded-[22px] p-5 mb-5 text-left text-white shadow-lg" style={{ background: "linear-gradient(135deg,#C9920A 0%,#E0AE2A 100%)" }}>
      {onCerrar && (
        <button onClick={onCerrar} aria-label="Ahora no" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center gap-3 mb-3 pr-8">
        <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          {paso === "bloqueado" ? <Settings className="w-6 h-6" /> : paso === "segundo_plano" ? <MapPin className="w-6 h-6" /> : <BellRing className="w-6 h-6" />}
        </div>
        <p className="m-0 text-[17px] font-black leading-tight">{titulo}</p>
      </div>

      <p className="m-0 mb-2 text-[13px] leading-[1.5] text-white/95">
        Al llegar te recordamos tus sellos y los premios que tienes cerca, para que no se te pase pedirlos en caja.
      </p>
      {/* Divulgación exigida por Google Play: visible, antes del diálogo del sistema. */}
      <p className="m-0 mb-4 rounded-xl bg-black/15 px-3 py-2.5 text-[12px] leading-[1.5] text-white">
        {TEXTO_DIVULGACION}
      </p>
      {paso === "segundo_plano" && (
        <p className="m-0 mb-4 text-[12.5px] font-semibold leading-[1.5]">
          Así te avisamos aunque tengas la app cerrada. Te mostramos exactamente dónde tocar.
        </p>
      )}
      {paso === "bloqueado" && (
        <p className="m-0 mb-4 text-[12.5px] font-semibold leading-[1.5]">
          {plataforma === "ios"
            ? "En Ajustes, toca Ubicación → Siempre (o Al usar la app), y Notificaciones → Permitir."
            : "En Ajustes, toca Permisos → Ubicación → Permitir todo el tiempo, y Notificaciones → Permitir."}
        </p>
      )}

      <button
        onClick={onActivar}
        disabled={cargando}
        className="w-full h-12 rounded-2xl bg-white text-[#8A6200] text-[14px] font-black shadow-md active:scale-[0.98] transition disabled:opacity-60"
      >
        {cargando ? "Un momento…" : boton}
      </button>
      {onCerrar && (
        <button onClick={onCerrar} className="w-full mt-2 h-9 text-[12.5px] font-bold text-white/90">
          Ahora no
        </button>
      )}
    </div>
  );
}

// ── Guía a pantalla completa ─────────────────────────────────────────────────

const DORADO = "#C9920A";

function GeoPushGuia({
  fase,
  plataforma,
  porAjustes,
  cargando,
  onContinuar,
  onReintentar,
  onCerrar,
}: {
  fase: Fase;
  plataforma: "android" | "ios";
  porAjustes: boolean;
  cargando: boolean;
  onContinuar: () => void;
  onReintentar: () => void;
  onCerrar: () => void;
}) {
  const ios = plataforma === "ios";

  let contenido: React.ReactNode;
  if (fase === "listo") {
    contenido = (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(157,204,101,0.15)" }}>
          <CheckCircle2 className="w-11 h-11" style={{ color: "#7FB23F" }} />
        </div>
        <p className="m-0 text-[26px] font-black text-slate-900">Listo</p>
        <p className="m-0 mt-2 text-[15px] leading-[1.5] text-slate-600 max-w-[300px]">
          Te avisamos cuando pases por Patio Curauma, aunque tengas la app cerrada.
        </p>
      </div>
    );
  } else if (fase === "falta") {
    contenido = (
      <div className="flex-1 flex flex-col justify-center">
        <p className="m-0 text-[13px] font-black uppercase tracking-wide" style={{ color: DORADO }}>Falta un toque</p>
        {ios ? (
          <>
            <p className="m-0 mt-1 text-[24px] font-black leading-tight text-slate-900">Falta un permiso</p>
            <p className="m-0 mt-3 text-[15px] leading-[1.5] text-slate-600">
              En Ajustes revisa que <b className="text-slate-900">Ubicación</b> esté en Siempre o Al usar la app, y que{" "}
              <b className="text-slate-900">Notificaciones</b> esté permitido.
            </p>
          </>
        ) : (
          <>
            <p className="m-0 mt-1 text-[24px] font-black leading-tight text-slate-900">Quedó en “Solo con la app en uso”</p>
            <p className="m-0 mt-3 text-[15px] leading-[1.5] text-slate-600">
              Así el aviso no te llega con la app cerrada. Lo único que falta es elegir{" "}
              <b className="text-slate-900">Permitir todo el tiempo</b>.
            </p>
          </>
        )}
        {porAjustes && !ios && (
          <p className="m-0 mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[13.5px] leading-[1.5] text-amber-900">
            Tu teléfono ya no muestra la pregunta. En Ajustes toca <b>Permisos</b> → <b>Ubicación</b> y marca{" "}
            <b>Permitir todo el tiempo</b>.
          </p>
        )}
      </div>
    );
  } else {
    contenido = (
      <div className="flex-1 flex flex-col">
        <p className="m-0 text-[13px] font-black uppercase tracking-wide" style={{ color: DORADO }}>Último paso</p>
        <p className="m-0 mt-1 text-[24px] font-black leading-tight text-slate-900">
          {ios ? "Toca “Cambiar a Permitir siempre”" : "Elige “Permitir todo el tiempo”"}
        </p>
        <p className="m-0 mt-2 text-[14.5px] leading-[1.5] text-slate-600">
          {ios
            ? "Tu iPhone te va a preguntar si el aviso puede funcionar siempre. Es la opción de abajo."
            : porAjustes
              ? "Se abren los ajustes de Club Patio. Toca Permisos → Ubicación, marca la primera opción y vuelve a la app."
              : "Se abre una pantalla de tu teléfono. Marca la primera opción y vuelve con la flecha."}
        </p>
        <div className="my-5 flex justify-center">{ios ? <MaquetaIOS /> : <MaquetaAndroid />}</div>
        {/* Divulgación exigida por Google Play: visible, antes de la pantalla del sistema. */}
        <p className="m-0 rounded-xl bg-slate-100 px-3 py-2.5 text-[11.5px] leading-[1.5] text-slate-500">{TEXTO_DIVULGACION}</p>
        {fase === "esperando_ajustes" && (
          <p className="m-0 mt-3 text-center text-[13px] font-bold" style={{ color: DORADO }}>
            Cuando lo marques, vuelve a la app.
          </p>
        )}
      </div>
    );
  }

  const principal =
    fase === "listo" ? { texto: "Entendido", accion: onCerrar } :
    fase === "falta" ? { texto: porAjustes ? "Abrir ajustes" : "Intentar de nuevo", accion: porAjustes ? onContinuar : onReintentar } :
    { texto: ios ? "Continuar" : porAjustes ? "Abrir ajustes" : "Ir a elegirlo", accion: onContinuar };

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-white"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex justify-end px-4">
        <button onClick={onCerrar} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 flex flex-col">{contenido}</div>
      <div className="px-6 pt-3">
        <button
          onClick={principal.accion}
          disabled={cargando}
          className="w-full h-14 rounded-2xl text-white text-[16px] font-black shadow-md active:scale-[0.98] transition disabled:opacity-60"
          style={{ backgroundColor: DORADO }}
        >
          {cargando ? "Un momento…" : principal.texto}
        </button>
        {fase !== "listo" && (
          <button onClick={onCerrar} className="w-full mt-1 h-11 text-[14px] font-bold text-slate-400">
            Ahora no
          </button>
        )}
      </div>
    </div>
  );
}

/** Cómo se ve la pantalla de permiso de Android, con la opción a tocar marcada. */
function MaquetaAndroid() {
  const opciones = ["Permitir todo el tiempo", "Permitir solo con la app en uso", "Preguntar siempre", "No permitir"];
  return (
    <div className="w-full max-w-[330px] rounded-[26px] border border-slate-200 bg-[#F1F0F7] p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-700">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-[11px] font-semibold text-slate-400">← vuelve con esta flecha al final</span>
      </div>
      <p className="m-0 mt-3 text-[19px] text-slate-900">Permiso de Ubicación</p>
      <p className="m-0 mt-3 mb-1 text-[12px] font-medium text-[#3F5AA8]">Acceso a Ubicación para esta app</p>
      {opciones.map((o, i) => (
        <div
          key={o}
          className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 ${i === 0 ? "bg-white" : ""}`}
          style={i === 0 ? { boxShadow: `0 0 0 3px ${DORADO}` } : undefined}
        >
          <span
            className="w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center"
            style={{ borderColor: i === 0 ? DORADO : "#5B5E6B" }}
          >
            {i === 0 && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DORADO }} />}
          </span>
          <span className={`text-[14px] ${i === 0 ? "font-bold text-slate-900" : "text-slate-600"}`}>{o}</span>
          {i === 0 && (
            <span className="absolute -top-3 right-2 rounded-full px-2 py-0.5 text-[10.5px] font-black text-white animate-pulse" style={{ backgroundColor: DORADO }}>
              Toca aquí
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Cómo se ve la pregunta de iOS, con el botón a tocar marcado. */
function MaquetaIOS() {
  return (
    <div className="w-full max-w-[290px] rounded-[18px] bg-[#F2F2F7] text-center shadow-md border border-slate-200">
      <div className="px-4 pt-4 pb-3">
        <p className="m-0 text-[14.5px] font-semibold leading-snug text-slate-900">
          ¿Permitir que “Club Patio” use tu ubicación también cuando no estés usando la app?
        </p>
        <p className="m-0 mt-1.5 text-[12px] leading-snug text-slate-600">
          Con “Siempre”, Club Patio te avisa al llegar a Patio Curauma aunque la app esté cerrada.
        </p>
      </div>
      <div className="border-t border-slate-300 py-2.5 text-[15px] text-[#0A7AFF]">Mantener “Al usar la app”</div>
      <div className="relative rounded-b-[18px] border-t border-slate-300 bg-white py-2.5 text-[15px] font-semibold text-[#0A7AFF]" style={{ boxShadow: `inset 0 0 0 3px ${DORADO}` }}>
        Cambiar a “Permitir siempre”
        <span className="absolute -top-3 right-2 rounded-full px-2 py-0.5 text-[10.5px] font-black text-white animate-pulse" style={{ backgroundColor: DORADO }}>
          Toca aquí
        </span>
      </div>
    </div>
  );
}
