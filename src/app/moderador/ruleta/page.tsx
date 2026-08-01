"use client";

/**
 * Ruleta de premios del stand.
 *
 * Funciona SOLA, sin base de datos: quien aprieta gira, y se lleva en el
 * momento lo que salga. Los premios no se consumen — la misma rueda sirve toda
 * la tarde para toda la gente que pase. Lo que limita la entrega es el stock
 * físico del mostrador, no un contador en Firestore.
 *
 * Esto es deliberado y no una simplificación: la versión anterior sorteaba
 * entre socios registrados y quemaba el premio, lo que obligaba a tener
 * servidor, sesión y red viva en cada giro. Como atracción de stand eso solo
 * agrega maneras de fallar frente a una fila de gente esperando.
 *
 * Los bloques (nombre y color) los edita el operador desde el engranaje y
 * quedan guardados en el navegador del tótem. Sin backend: la configuración
 * pertenece al equipo que está mostrando la rueda, no a la cuenta.
 *
 * Se dibuja sobre el lienzo fijo de 256×768 del tótem y se escala a la ventana.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { canAccessModPanel } from "@/lib/constants";
import { habilitarSonido, sonarArranque, sonarGiro, sonarGanador } from "@/lib/sonidoRuleta";
import { Confeti } from "@/components/Confeti";
import { Loader2, Volume2, Settings, Plus, Trash2, X, RotateCcw, Monitor, Smartphone } from "lucide-react";

/**
 * Lienzo del tótem LED vertical (195×65 cm reales). Ya no es el formato por
 * defecto —la ruleta ocupa toda la pantalla— pero se conserva entero: se activa
 * con `?totem=1` y vuelve exactamente al diseño anterior sin tener que rehacer
 * nada si la rueda tiene que volver a esa pantalla.
 */
const TOTEM_ANCHO = 256;
const TOTEM_ALTO = 768;

/**
 * Sistema de coordenadas interno del SVG. NO es el tamaño en pantalla: la rueda
 * se dibuja siempre sobre este lienzo de 244 y se estira con width/height, así
 * que todo lo de adentro —porciones, textos, ejes— escala solo y la geometría
 * no depende del tamaño real.
 */
const DIAMETRO = 244;
const VUELTAS = 6;
const GIRO_MS = 5200;
const REVELAR_MS = GIRO_MS + 700;
/** Cuánto queda el premio en pantalla si nadie vuelve a girar. */
const OCULTAR_MS = 9000;

type Bloque = { id: string; nombre: string; color: string };

/**
 * Punto de partida: los premios reales de la Expovino. Es solo el valor
 * inicial — desde el engranaje se cambian, se borran y se agregan.
 */
const BLOQUES_INICIALES: Bloque[] = [
  { id: "b1", nombre: "Portacopa Club Patio",   color: "#7B1E3A" },
  { id: "b2", nombre: "Llavero Club Patio",     color: "#1E1033" },
  { id: "b3", nombre: "Pisco sour en Magura",   color: "#9E2A4C" },
  { id: "b4", nombre: "Café en Pomarus",        color: "#0F1B4C" },
  { id: "b5", nombre: "Pastel Le Cafeteríe",    color: "#5B1230" },
  { id: "b6", nombre: "10% de descuento",       color: "#2A0D1B" },
];

/** Colores sugeridos al agregar un bloque nuevo. */
const COLORES = ["#7B1E3A", "#1E1033", "#9E2A4C", "#0F1B4C", "#5B1230", "#2A0D1B", "#146356", "#7A4A0F"];

function clave(campana: string) {
  return `ruleta_bloques_v1_${campana}`;
}

/** El formato elegido se recuerda: al reiniciar el equipo vuelve como estaba. */
const CLAVE_FORMATO = "ruleta_formato_v1";

/** Estilo de las dos opciones de formato: la vigente va destacada. */
function opcionFormato(activo: boolean): CSSProperties {
  return {
    flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: activo ? "rgba(212,175,55,0.2)" : "rgba(0,0,0,0.3)",
    border: `1px solid ${activo ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.12)"}`,
    color: activo ? "#D4AF37" : "rgba(250,243,224,0.55)",
  };
}

/** Botones discretos de la esquina — mismo aspecto para los dos. */
const BOTON_ESQUINA: CSSProperties = {
  width: 34, height: 34, borderRadius: 10, cursor: "pointer",
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.28)",
  color: "rgba(212,175,55,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

/**
 * Texto claro u oscuro según el fondo que eligió el operador.
 *
 * Se calcula en vez de pedirlo: nadie debería tener que elegir dos colores y
 * darse cuenta recién en la pantalla grande de que el texto no se lee.
 */
function textoSobre(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#FFF3E2";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Luminancia percibida: el ojo pesa mucho más el verde que el azul.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1A0A10" : "#FFF3E2";
}

/**
 * Corta el nombre del premio en líneas cortas.
 *
 * El texto va TANGENCIAL —perpendicular al radio, como en las ruletas de feria—
 * y no a lo largo del radio. Radialmente solo hay ~100 px útiles antes de topar
 * con el eje, así que un nombre largo cruzaba el centro y se salía por el borde.
 * Tangencialmente el ancho disponible es el arco de la porción, y se puede
 * apilar hacia adentro.
 */
const MAX_LINEAS = 3;
function partirTexto(texto: string, maxLinea: number): string[] {
  const palabras = texto.replace(/\s*·\s*/g, " ").trim().split(/\s+/);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const cand = actual ? `${actual} ${p}` : p;
    if (cand.length <= maxLinea) { actual = cand; continue; }
    if (actual) lineas.push(actual);
    actual = p.length > maxLinea ? `${p.slice(0, maxLinea - 1)}…` : p;
    if (lineas.length === MAX_LINEAS) break;
  }
  if (actual && lineas.length < MAX_LINEAS) lineas.push(actual);
  return lineas;
}

export default function RuletaPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [campana, setCampana] = useState("expovino");
  const [totem, setTotem] = useState(false);
  const [vista, setVista] = useState({ w: 1280, h: 720 });
  const [bloques, setBloques] = useState<Bloque[]>(BLOQUES_INICIALES);
  const [cargado, setCargado] = useState(false);
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [premio, setPremio] = useState<Bloque | null>(null);
  const [revelado, setRevelado] = useState(false);
  /** Sube en cada premio. Sirve de `key` para relanzar las animaciones. */
  const [celebracion, setCelebracion] = useState(0);
  const [audioTocado, setAudioTocado] = useState(false);
  const [editando, setEditando] = useState(false);
  /** Espejo del estado para el atajo de teclado, que se registra una sola vez. */
  const puedeGirar = useRef(false);
  /** Los bloques vigentes, para leerlos dentro del giro sin re-crear el handler. */
  const bloquesRef = useRef<Bloque[]>(bloques);
  bloquesRef.current = bloques;
  /** Temporizadores del giro en curso, para cancelarlos si se gira de nuevo. */
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get("campana");
    if (p) setCampana(p.trim().toLowerCase());
    // El parámetro de la URL manda —sirve para forzar un formato desde un
    // acceso directo—; si no viene, se respeta lo último que se eligió acá.
    if (q.has("totem")) setTotem(q.get("totem") === "1");
    else {
      try { setTotem(localStorage.getItem(CLAVE_FORMATO) === "totem"); } catch { /* sin acceso */ }
    }
  }, []);

  const cambiarFormato = () => {
    const nuevo = !totem;
    setTotem(nuevo);
    try { localStorage.setItem(CLAVE_FORMATO, nuevo ? "totem" : "completa"); } catch { /* sin acceso */ }
  };

  useEffect(() => {
    const ajustar = () => setVista({ w: window.innerWidth, h: window.innerHeight });
    ajustar();
    window.addEventListener("resize", ajustar);
    // Girar una tablet no siempre dispara resize a tiempo en iOS.
    window.addEventListener("orientationchange", ajustar);
    return () => {
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("orientationchange", ajustar);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        const ok = canAccessModPanel(u.email, (snap.data() as { rol?: string; roles?: string[] }) ?? null);
        setAutorizado(ok);
        if (!ok) router.replace("/");
      } catch { router.replace("/"); }
    });
    return () => unsub();
  }, [router]);

  // ── Configuración guardada en el navegador ────────────────────────────────
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(clave(campana));
      if (crudo) {
        const d = JSON.parse(crudo);
        if (Array.isArray(d) && d.length) setBloques(d);
      }
    } catch { /* configuración corrupta: se sigue con la inicial */ }
    setCargado(true);
  }, [campana]);

  useEffect(() => {
    // No se guarda antes de leer, o el primer render pisaría lo configurado.
    if (!cargado) return;
    try { localStorage.setItem(clave(campana), JSON.stringify(bloques)); } catch { /* cuota llena */ }
  }, [bloques, campana, cargado]);

  // ── El giro ───────────────────────────────────────────────────────────────
  const girar = useCallback(() => {
    if (!puedeGirar.current) return;
    puedeGirar.current = false;

    // Los bloques se leen de una referencia y no del actualizador de estado:
    // React puede invocar un actualizador más de una vez, y acá adentro hay
    // efectos —sonido y temporizadores— que se dispararían duplicados.
    // Si se gira sobre un premio que todavía está en pantalla, los
    // temporizadores del giro anterior siguen pendientes y ocultarían el
    // resultado nuevo a destiempo.
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];

    const actuales = bloquesRef.current;
    const n = actuales.length;
    const paso = 360 / n;
    const idx = Math.floor(Math.random() * n);

    setRevelado(false);
    setGirando(true);
    sonarArranque();
    sonarGiro(GIRO_MS, n);

    setAngulo((prev) => {
      // Se acumula sobre el ángulo actual para que nunca gire hacia atrás.
      const base = Math.ceil(prev / 360) * 360;
      // Desvío pequeño para que no aterrice siempre clavado al centro.
      const desvio = (Math.random() - 0.5) * paso * 0.5;
      return base + VUELTAS * 360 - (idx * paso + paso / 2) - desvio;
    });

    temporizadores.current.push(setTimeout(() => {
      setGirando(false);
      setPremio(actuales[idx]);
      setRevelado(true);
      setCelebracion((c) => c + 1);
      sonarGanador();
      // Se puede volver a girar apenas se revela: con fila esperando, obligar a
      // aguantar los segundos del premio anterior frena la atracción entera.
      puedeGirar.current = true;
    }, REVELAR_MS));

    // Si nadie gira, el premio se retira solo y vuelve la invitación.
    temporizadores.current.push(setTimeout(() => setRevelado(false), REVELAR_MS + OCULTAR_MS));
  }, []);

  // Habilitación del giro: hace falta sonido activado, al menos dos bloques y
  // no estar editando ni girando. Mostrando un premio SÍ se puede girar: el
  // toque del siguiente en la fila arranca su tirada de inmediato.
  useEffect(() => {
    puedeGirar.current = audioTocado && !editando && !girando && bloques.length >= 2;
  }, [audioTocado, editando, girando, bloques.length]);

  // Teclado: además del toque, un presentador inalámbrico (que el sistema ve
  // como teclado) permite girar a distancia sin tocar el tótem.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if ([" ", "Enter", "ArrowRight", "PageDown"].includes(e.key)) {
        e.preventDefault();
        girar();
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [girar]);

  useEffect(() => () => { temporizadores.current.forEach(clearTimeout); }, []);

  if (autorizado === null) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B0407" }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#D4AF37" }} />
      </main>
    );
  }
  if (!autorizado) return null;

  const r = DIAMETRO / 2;
  const n = bloques.length;
  const paso = n ? 360 / n : 60;
  // El texto se achica al agregar bloques: en porciones angostas un tamaño fijo
  // se sale por los costados. Va en unidades del viewBox, así que vale igual a
  // cualquier tamaño de pantalla.
  const tamTexto = n <= 6 ? 11.5 : n <= 8 ? 10 : n <= 10 ? 8.8 : 7.8;
  const maxLinea = n <= 6 ? 13 : n <= 8 ? 12 : 11;
  const altoLinea = tamTexto * 1.1;

  // ── Medidas del lienzo ────────────────────────────────────────────────────
  // En modo tótem se dibuja sobre 256×768 y se escala para calzar con la
  // pantalla física. En pantalla completa el lienzo ES la ventana.
  const lienzo = totem ? { w: TOTEM_ANCHO, h: TOTEM_ALTO } : vista;
  const escala = totem ? Math.min(vista.w / TOTEM_ANCHO, vista.h / TOTEM_ALTO) : 1;

  // Apaisado: la rueda va al lado del texto en vez de encima. En un monitor
  // 16:9 apilarlos deja la rueda diminuta y los costados vacíos.
  const apaisado = lienzo.w / lienzo.h > 1.15;
  const D = apaisado
    ? Math.min(lienzo.h * 0.88, lienzo.w * 0.52)
    : Math.min(lienzo.w * 0.92, lienzo.h * 0.60);

  // Todo lo que está FUERA del SVG se mide contra el diseño original (rueda de
  // 244 px) para que las proporciones se mantengan en cualquier pantalla. El
  // tope evita que en un televisor los títulos se coman la rueda.
  const k = Math.max(0.75, Math.min(D / 244, 3.4));
  const px = (v: number) => Math.round(v * k);

  // El confeti estalla desde el centro real de la rueda, que se mueve según el
  // formato. En apaisado la rueda está a la izquierda; reventar siempre al
  // medio de la pantalla dejaría el estallido despegado de la ruleta.
  const origenConfeti = apaisado
    ? { x: (lienzo.w / 2 - (D + px(30)) / 2 + D / 2) / vista.w, y: 0.5 }
    : { x: 0.5, y: 0.42 };

  return (
    <main style={{
      width: "100vw", height: "100vh", overflow: "hidden", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div
        onClick={girar}
        style={{
          width: lienzo.w, height: lienzo.h, flexShrink: 0,
          transform: totem ? `scale(${escala})` : undefined,
          transformOrigin: "center center",
          background: "radial-gradient(120% 70% at 50% 22%, #3A0E1D 0%, #12060B 62%, #050203 100%)",
          color: "#fff", position: "relative", overflow: "hidden",
          display: "flex",
          flexDirection: apaisado ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: apaisado ? px(30) : px(14),
          fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
          padding: apaisado ? `${px(16)}px ${px(24)}px` : `${px(22)}px ${px(10)}px`,
          cursor: girando ? "default" : "pointer",
          userSelect: "none",
        }}
      >

        {/* En vertical el título va arriba de la rueda; en apaisado se mueve a la
            columna de la derecha, junto al premio. */}
        {!apaisado && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: px(12), fontWeight: 900, color: "#D4AF37", letterSpacing: 2.4 * k }}>
              GIRA Y GANA
            </p>
            <p style={{ margin: `${px(5)}px 0 0`, fontSize: px(11), color: "rgba(250,243,224,0.5)" }}>
              Club Patio Curauma
            </p>
          </div>
        )}

        {/* ── Rueda ── */}
        <div style={{ position: "relative", width: D, height: D, flexShrink: 0 }}>
          {/* Halo que late mientras gira */}
          <div style={{
            position: "absolute", inset: -px(14), borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,0.32) 0%, transparent 68%)",
            opacity: girando ? 1 : 0.35,
            transition: "opacity .6s ease",
            animation: girando ? "latido 1.1s ease-in-out infinite" : "none",
          }} />

          {/* Onda expansiva al salir el premio. La `key` la remonta en cada
              giro: sin eso la animación solo correría la primera vez. */}
          {celebracion > 0 && (
            <div key={`onda-${celebracion}`} style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `${px(3)}px solid #FFD84D`,
              animation: "onda 900ms ease-out forwards",
              pointerEvents: "none", zIndex: 5,
            }} />
          )}

          {/* Ampolletas del borde, como una rueda de feria. Van en una capa
              APARTE que no rota: si giraran con la rueda, el destello se
              confundiría con el movimiento y dejaría de leerse como luces. */}
          <svg
            width={D + px(18)} height={D + px(18)}
            viewBox="0 0 262 262"
            style={{ position: "absolute", inset: -px(9), zIndex: 3, pointerEvents: "none" }}
          >
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
              const cx = 131 + 127 * Math.cos(a);
              const cy = 131 + 127 * Math.sin(a);
              return (
                <circle
                  key={i} cx={cx} cy={cy} r={4} fill="#FFD84D"
                  style={{
                    // El retraso negativo escalonado convierte el parpadeo en
                    // una ola que recorre el borde.
                    animation: `ampolleta ${girando ? 0.5 : 1.5}s linear infinite`,
                    animationDelay: `-${(i / 24) * (girando ? 0.5 : 1.5)}s`,
                    filter: "drop-shadow(0 0 4px rgba(255,216,77,0.9))",
                  }}
                />
              );
            })}
          </svg>

          <div style={{
            position: "absolute", top: -px(12), left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, zIndex: 4,
            borderLeft: `${px(13)}px solid transparent`,
            borderRight: `${px(13)}px solid transparent`,
            borderTop: `${px(24)}px solid #D4AF37`,
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.75))",
          }} />

          <svg
            width={D} height={D} viewBox={`0 0 ${DIAMETRO} ${DIAMETRO}`}
            style={{
              position: "relative", zIndex: 2,
              transform: `rotate(${angulo}deg)`,
              // La transición va SIEMPRE puesta, no condicionada a `girando`.
              // Si se activa en el mismo render en que cambia el transform, el
              // navegador aplica el giro de golpe: la transición no estaba
              // vigente cuando el valor cambió, así que no hay nada que animar.
              transition: `transform ${GIRO_MS}ms cubic-bezier(.09,.72,.06,1)`,
              filter: "drop-shadow(0 6px 22px rgba(0,0,0,0.6))",
            }}
          >
            {bloques.map((b, i) => {
              const a0 = (i * paso - 90) * (Math.PI / 180);
              const a1 = ((i + 1) * paso - 90) * (Math.PI / 180);
              const x0 = r + r * Math.cos(a0), y0 = r + r * Math.sin(a0);
              const x1 = r + r * Math.cos(a1), y1 = r + r * Math.sin(a1);
              const grande = paso > 180 ? 1 : 0;

              // Centro de ESTA porción en coordenadas SVG (0 = a la derecha).
              // El -90 es el mismo desfase con que se dibuja el path.
              const centro = i * paso + paso / 2 - 90;
              // Centro del texto: coordenadas ABSOLUTAS sobre el radio medio.
              // Se calculan aparte de la rotación porque `rotate` sobre el
              // centro controlaría a la vez posición y orientación, y acá hacen
              // falta distintas: ubicado en su porción, pero girado tangencial.
              const radioTexto = r * 0.64;
              const rad = (centro * Math.PI) / 180;
              const cx = r + radioTexto * Math.cos(rad);
              const cy = r + radioTexto * Math.sin(rad);

              // Tangencial = perpendicular al radio. Si queda de cabeza se le
              // suman 180°, que en una tangente sigue siendo tangente.
              let giro = centro + 90;
              const giroNorm = ((giro % 360) + 360) % 360;
              if (giroNorm > 90 && giroNorm < 270) giro += 180;

              const lineas = partirTexto(b.nombre, maxLinea);

              // Una sola porción no tiene cuerda que dibujar: es el círculo
              // completo y el path con arco degenera en nada visible.
              const forma = n === 1
                ? `M ${r} ${r} m ${-r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
                : `M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 ${grande} 1 ${x1} ${y1} Z`;

              return (
                <g key={b.id}>
                  <path d={forma} fill={b.color} stroke="rgba(212,175,55,0.55)" strokeWidth={1.6} />
                  <text
                    fill={textoSobre(b.color)} fontSize={tamTexto} fontWeight={800}
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`translate(${cx} ${cy}) rotate(${giro})`}
                    style={{ letterSpacing: "-0.2px" }}
                  >
                    {lineas.map((l, k) => (
                      <tspan key={k} x={0} y={(k - (lineas.length - 1) / 2) * altoLinea}>
                        {l}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
            <circle cx={r} cy={r} r={r - 1} fill="none" stroke="#D4AF37" strokeWidth={3.5} />
            <circle cx={r} cy={r} r={20} fill="#12060B" stroke="#D4AF37" strokeWidth={3} />
            <circle cx={r} cy={r} r={7} fill="#D4AF37" />
          </svg>
        </div>

        {/* ── Invitación a girar, o el premio ── */}
        {/* Los dos se superponen en el mismo hueco y se cruzan con opacidad. Si
            se alternaran mostrando uno u otro, el layout saltaría en cada giro
            y la rueda se correría de lugar a la vista de todos. */}
        <div style={{
          position: "relative",
          width: apaisado ? Math.min(lienzo.w - D - px(70), px(330)) : "100%",
          maxWidth: apaisado ? undefined : px(330),
          height: apaisado ? D * 0.8 : px(168),
          flexShrink: 0,
        }}>

          {/* Invitación (visible cuando la rueda está quieta) */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: px(8), textAlign: "center",
            opacity: !girando && !revelado ? 1 : 0,
            transition: "opacity .4s ease",
            pointerEvents: "none",
          }}>
            {apaisado && (
              <p style={{ margin: `0 0 ${px(6)}px`, fontSize: px(12), fontWeight: 900, color: "#D4AF37", letterSpacing: 2.4 * k }}>
                CLUB PATIO CURAUMA
              </p>
            )}
            <p style={{
              margin: 0, fontSize: px(27), fontWeight: 900, color: "#D4AF37",
              letterSpacing: k, lineHeight: 1.1,
              animation: "respira 1.8s ease-in-out infinite",
            }}>
              TOCA PARA GIRAR
            </p>
            <p style={{ margin: 0, fontSize: px(12), color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>
              Todos ganan algo<br />Retíralo en el mostrador
            </p>
          </div>

          {/* Premio */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center",
            opacity: revelado && premio ? 1 : 0,
            transform: revelado ? "translateY(0) scale(1)" : `translateY(${px(14)}px) scale(.96)`,
            transition: "opacity .5s ease, transform .5s cubic-bezier(.34,1.56,.64,1)",
            pointerEvents: "none",
          }}>
            {premio && (
              <>
                <div style={{
                  position: "relative", overflow: "hidden",
                  width: "100%", borderRadius: px(18), padding: `${px(16)}px ${px(12)}px`,
                  background: "linear-gradient(150deg, rgba(212,175,55,0.28), rgba(123,30,58,0.34))",
                  border: `${px(2)}px solid rgba(212,175,55,0.75)`,
                  boxShadow: `0 0 ${px(34)}px rgba(212,175,55,0.4)`,
                }}>
                  {/* Barrido de luz sobre la tarjeta, como metal pulido. Se
                      repite en bucle para que el premio no se quede inerte
                      mientras la persona lo lee. */}
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, width: "45%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)",
                    animation: "brillo 2.6s ease-in-out infinite",
                    pointerEvents: "none",
                  }} />
                  <p style={{ margin: 0, fontSize: px(10), fontWeight: 900, color: "#FFD84D", letterSpacing: 2 * k }}>
                    GANASTE
                  </p>
                  <p style={{
                    margin: `${px(8)}px 0 0`, fontWeight: 900, lineHeight: 1.12, color: "#fff",
                    fontSize: px(premio.nombre.length <= 14 ? 27 : premio.nombre.length <= 22 ? 22 : 18),
                  }}>
                    {premio.nombre}
                  </p>
                </div>
                <p style={{ margin: `${px(11)}px 0 0`, fontSize: px(11), color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                  Retíralo en el mostrador<br />del Club Patio Curauma
                </p>
              </>
            )}
          </div>
        </div>

        {/* Habilitación del sonido. Los navegadores no dejan sonar nada hasta
            que alguien toca la página, y esto se monta sin que nadie la toque:
            hace falta un toque explícito al instalarla.

            Se cierra con el toque AUNQUE el audio falle: si el navegador del
            tótem no soporta Web Audio, un overlay que no se va dejaría la
            pantalla tapada toda la tarde. Sin sonido se puede vivir; con la
            ruleta oculta, no. */}
        {!audioTocado && (
          <button
            onClick={async (e) => { e.stopPropagation(); setAudioTocado(true); await habilitarSonido(); }}
            style={{
              position: "absolute", inset: 0, zIndex: 8, border: "none",
              background: "rgba(5,2,3,0.92)", color: "#D4AF37", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 14, padding: "0 24px",
            }}
          >
            <Volume2 style={{ width: px(54), height: px(54) }} />
            <span style={{ fontSize: px(21), fontWeight: 900, letterSpacing: k }}>
              Toca para activar el sonido
            </span>
            <span style={{ fontSize: px(13), color: "rgba(250,243,224,0.55)", lineHeight: 1.5, textAlign: "center" }}>
              Una sola vez, antes de empezar.<br />Después ya queda girando.
            </span>
          </button>
        )}

        {/* Fogonazo dorado en el instante del premio. Cubre todo el lienzo y se
            apaga solo; va sobre la rueda pero bajo el confeti. */}
        {celebracion > 0 && (
          <div key={`destello-${celebracion}`} style={{
            position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none",
            background: "radial-gradient(circle at 50% 42%, rgba(255,216,77,0.85) 0%, rgba(212,175,55,0.35) 35%, transparent 70%)",
            animation: "fogonazo 780ms ease-out forwards",
          }} />
        )}

        <style>{`
          @keyframes latido {
            0%, 100% { opacity: .55; transform: scale(1); }
            50%      { opacity: 1;   transform: scale(1.06); }
          }
          @keyframes respira {
            0%, 100% { opacity: .72; transform: scale(1); }
            50%      { opacity: 1;   transform: scale(1.045); }
          }
          @keyframes ampolleta {
            0%, 45%   { opacity: .18; }
            50%, 60%  { opacity: 1; }
            65%, 100% { opacity: .18; }
          }
          @keyframes onda {
            0%   { transform: scale(.82); opacity: .95; }
            100% { transform: scale(1.9); opacity: 0; }
          }
          @keyframes fogonazo {
            0%   { opacity: 0; }
            12%  { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes brillo {
            0%   { transform: translateX(-130%) skewX(-18deg); }
            55%  { transform: translateX(130%)  skewX(-18deg); }
            100% { transform: translateX(130%)  skewX(-18deg); }
          }
        `}</style>
      </div>

      {/* El confeti va fuera del lienzo escalado: en modo tótem el `scale`
          también encogería las partículas y el estallido perdería la mitad de
          su fuerza justo cuando más se mira. */}
      <Confeti disparo={celebracion} origen={origenConfeti} />

      {/* Engranaje: discreto y fuera del lienzo escalado, para que no cambie de
          tamaño con la pantalla y para que nadie del público lo apriete
          buscando el botón de girar. */}
      {!editando && audioTocado && (
        <div style={{ position: "fixed", top: 10, left: 10, zIndex: 20, display: "flex", gap: 8 }}>
          <button
            onClick={() => setEditando(true)}
            title="Editar los bloques de la ruleta"
            style={BOTON_ESQUINA}
          >
            <Settings style={{ width: 17, height: 17 }} />
          </button>
          <button
            onClick={cambiarFormato}
            title={totem ? "Cambiar a pantalla completa" : "Cambiar al formato alargado del tótem"}
            style={BOTON_ESQUINA}
          >
            {totem
              ? <Monitor style={{ width: 17, height: 17 }} />
              : <Smartphone style={{ width: 17, height: 17 }} />}
          </button>
        </div>
      )}

      {editando && (
        <EditorBloques
          bloques={bloques}
          onCambiar={setBloques}
          onCerrar={() => setEditando(false)}
          totem={totem}
          onCambiarFormato={cambiarFormato}
        />
      )}
    </main>
  );
}

/**
 * Editor de los bloques.
 *
 * Va fuera del lienzo de 256 px a propósito: escalado al ancho del tótem los
 * campos quedarían de unos pocos milímetros y sería imposible escribir en ellos.
 * La rueda se escala porque tiene que calzar con la pantalla física; el editor
 * lo usa una persona en un navegador normal.
 */
function EditorBloques({
  bloques, onCambiar, onCerrar, totem, onCambiarFormato,
}: {
  bloques: Bloque[];
  onCambiar: (b: Bloque[]) => void;
  onCerrar: () => void;
  totem: boolean;
  onCambiarFormato: () => void;
}) {
  const nuevoId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const editar = (id: string, campo: "nombre" | "color", valor: string) =>
    onCambiar(bloques.map((b) => (b.id === id ? { ...b, [campo]: valor } : b)));

  const eliminar = (id: string) => onCambiar(bloques.filter((b) => b.id !== id));

  const agregar = () =>
    onCambiar([...bloques, {
      id: nuevoId(),
      nombre: "Premio nuevo",
      color: COLORES[bloques.length % COLORES.length],
    }]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 30, background: "rgba(5,2,3,0.94)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      overflowY: "auto", padding: "20px 14px 40px",
      fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#D4AF37", letterSpacing: 1.8 }}>
            BLOQUES DE LA RULETA
          </p>
          <button
            onClick={onCerrar}
            style={{
              width: 34, height: 34, borderRadius: 10, cursor: "pointer",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X style={{ width: 17, height: 17 }} />
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "rgba(250,243,224,0.5)", lineHeight: 1.5 }}>
          Se guardan en este equipo y se aplican al instante. Los premios no se
          gastan: la rueda sirve para toda la gente que pase.
        </p>

        {bloques.map((b, i) => (
          <div
            key={b.id}
            style={{
              display: "flex", alignItems: "center", gap: 9, marginBottom: 9,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 13, padding: "9px 10px",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(250,243,224,0.35)", width: 16, flexShrink: 0 }}>
              {i + 1}
            </span>
            <input
              type="color"
              value={b.color}
              onChange={(e) => editar(b.id, "color", e.target.value)}
              title="Color del bloque"
              style={{
                width: 36, height: 36, flexShrink: 0, padding: 0, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 9,
              }}
            />
            <input
              value={b.nombre}
              onChange={(e) => editar(b.id, "nombre", e.target.value)}
              placeholder="Nombre del premio"
              style={{
                flex: 1, minWidth: 0, padding: "9px 11px", borderRadius: 9, fontSize: 14,
                background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff",
              }}
            />
            <button
              onClick={() => eliminar(b.id)}
              disabled={bloques.length <= 2}
              title={bloques.length <= 2 ? "La ruleta necesita al menos 2 bloques" : "Eliminar"}
              style={{
                width: 34, height: 34, flexShrink: 0, borderRadius: 9,
                cursor: bloques.length <= 2 ? "not-allowed" : "pointer",
                background: "rgba(220,38,38,0.14)", border: "1px solid rgba(220,38,38,0.3)",
                color: bloques.length <= 2 ? "rgba(255,255,255,0.25)" : "#F87171",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: bloques.length <= 2 ? 0.5 : 1,
              }}
            >
              <Trash2 style={{ width: 15, height: 15 }} />
            </button>
          </div>
        ))}

        <button
          onClick={agregar}
          style={{
            width: "100%", padding: "12px", borderRadius: 13, marginTop: 4, cursor: "pointer",
            background: "rgba(212,175,55,0.12)", border: "1px dashed rgba(212,175,55,0.45)",
            color: "#D4AF37", fontSize: 14, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          <Plus style={{ width: 17, height: 17 }} />
          Agregar bloque
        </button>

        {/* Con muchos bloques el nombre deja de leerse desde lejos. Se avisa acá
            y no se impide: el operador sabe a qué distancia está su público. */}
        {bloques.length > 8 && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#FBBF24", lineHeight: 1.5 }}>
            Con {bloques.length} bloques el texto se achica bastante. Sobre 8 ya
            cuesta leerlo desde lejos en la pantalla.
          </p>
        )}

        {/* Formato de la pantalla. Va rotulado acá además del icono de la
            esquina: en una pantalla táctil no hay tooltip que lo explique. */}
        <div style={{
          marginTop: 22, borderRadius: 13, padding: "13px 14px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff" }}>
            Formato de la pantalla
          </p>
          <p style={{ margin: "3px 0 11px", fontSize: 12, color: "rgba(250,243,224,0.5)", lineHeight: 1.45 }}>
            {totem
              ? "Alargado, para el tótem LED vertical (256×768)."
              : "Pantalla completa, se adapta al monitor."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { if (totem) onCambiarFormato(); }}
              style={opcionFormato(!totem)}
            >
              <Monitor style={{ width: 15, height: 15 }} />
              Completa
            </button>
            <button
              onClick={() => { if (!totem) onCambiarFormato(); }}
              style={opcionFormato(totem)}
            >
              <Smartphone style={{ width: 15, height: 15 }} />
              Alargada
            </button>
          </div>
        </div>

        <button
          onClick={() => { if (confirm("¿Volver a los bloques originales?")) onCambiar(BLOQUES_INICIALES); }}
          style={{
            width: "100%", padding: "11px", borderRadius: 13, marginTop: 22, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(255,255,255,0.14)",
            color: "rgba(250,243,224,0.55)", fontSize: 13, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          <RotateCcw style={{ width: 14, height: 14 }} />
          Restaurar los originales
        </button>

        <button
          onClick={onCerrar}
          style={{
            width: "100%", padding: "15px", borderRadius: 14, marginTop: 10, cursor: "pointer",
            background: "linear-gradient(150deg, #D4AF37 0%, #B8860B 100%)",
            border: "none", color: "#2A0D1B", fontSize: 16, fontWeight: 900,
          }}
        >
          Listo
        </button>
      </div>
    </div>
  );
}
