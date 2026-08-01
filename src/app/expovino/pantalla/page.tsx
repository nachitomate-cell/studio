"use client";

/**
 * Pantalla del stand — tótem LED vertical de 195×65 cm, 256×768 píxeles.
 *
 * Rota entre el contador del evento y fichas de producto. El motivo es que una
 * pantalla que solo cuenta se vuelve mobiliario a los diez minutos: quien pasa
 * dos veces ya la vio. Alternando, cada pasada muestra algo distinto y el stand
 * sigue trabajando toda la noche.
 *
 * La escena del evento se intercala entre cada producto, no va una sola vez:
 * inscribir gente es el objetivo de la noche y el QR no puede desaparecer de
 * la vista por minutos.
 *
 * El diseño se dibuja sobre un lienzo FIJO de 256×768 escalado a la ventana, así
 * lo que se ve en el notebook es exactamente lo que sale en el tótem. A 256 px
 * de ancho y con paso de píxel de ~2,5 mm no hay lugar para detalle fino: todo
 * grueso, pocas palabras, y las cifras grandes — que es lo que se lee de lejos
 * y lo que convence.
 */

import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { CAMPANAS } from "@/lib/campanas";
import { CANONICAL_BASE_URL } from "@/lib/constants";
import { RuletaSorteo } from "@/components/RuletaSorteo";

const CAMPANA = CAMPANAS.expovino;
const REFRESCO_MS = 5000;
const ANCHO = 256;
const ALTO = 768;

type Datos = {
  total: number;
  ultimos: string[];
  nombresRuleta: string[];
  premiosDisponibles: number;
  sorteoId: string | null;
  ganador: { nombre: string; premio: string | null } | null;
};

type Producto = {
  clave: string;
  marca: string;
  fondo: string;
  acento: string;
  texto: string;
  cifra: string;
  cifraPie: string;
  titular: string;
  bajada: string;
  logo?: string;
};

const PRODUCTOS: Producto[] = [
  {
    clave: "clubpatio",
    marca: "CLUB PATIO CURAUMA",
    fondo: "linear-gradient(165deg,#0C0F08 0%,#1E2A12 55%,#0C0F08 100%)",
    acento: "#D3B673",
    texto: "#F4EEDD",
    cifra: "746",
    cifraPie: "socios activos",
    titular: "Fidelización\ncon sellos",
    bajada: "56 locales del recinto. Cada compra suma, cada sello acerca un premio.",
    logo: "/Logo2.png",
  },
  {
    clave: "rutabac",
    marca: "RUTA BAC · VALPARAÍSO",
    fondo: "linear-gradient(165deg,#0A1233 0%,#1a2b5c 55%,#0A1233 100%)",
    acento: "#FF4B91",
    texto: "#FDF1D6",
    cifra: "26",
    cifraPie: "locales en ruta",
    titular: "Una ruta\nque se sella",
    bajada: "Cerro Alegre y Concepción. Recorres, juntas sellos y canjeas.",
  },
  {
    clave: "wallo",
    marca: "WALLO",
    fondo: "linear-gradient(165deg,#101010 0%,#2A2418 55%,#101010 100%)",
    acento: "#C9A84C",
    texto: "#F6EFE0",
    cifra: "2",
    cifraPie: "Apple y Google Wallet",
    titular: "Tu tarjeta\nen el celular",
    bajada: "Sin instalar apps. Llega a la pantalla de bloqueo y se actualiza sola.",
  },
  {
    clave: "agenda",
    marca: "AGENDA SYNAPTECH",
    fondo: "linear-gradient(165deg,#04120F 0%,#0C2A24 55%,#04120F 100%)",
    acento: "#4ADE9B",
    texto: "#E6FBF3",
    cifra: "8.691",
    cifraPie: "clientes gestionados",
    titular: "Reservas\nsin llamadas",
    bajada: "27 locales y 85 profesionales agendando solos, todos los días.",
  },
];

/** Orden de rotación: el evento vuelve entre cada producto. */
const GUION: { tipo: "evento" | "producto"; producto?: Producto; ms: number }[] = [
  { tipo: "evento", ms: 15000 },
  ...PRODUCTOS.flatMap((p) => [
    { tipo: "producto" as const, producto: p, ms: 10000 },
    { tipo: "evento" as const, ms: 15000 },
  ]),
];

export default function PantallaExpovino() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [campana, setCampana] = useState(CAMPANA.slug);
  const [escala, setEscala] = useState(1);
  const [subio, setSubio] = useState(false);
  const [paso, setPaso] = useState(0);
  const [visible, setVisible] = useState(true);
  // Ruleta: se dispara al aparecer un sorteo que la pantalla no había mostrado.
  const [ruletaDe, setRuletaDe] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("campana");
    if (p) setCampana(p.trim().toLowerCase());
  }, []);

  useEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  // ── Rotación con fundido: se apaga, se cambia, se enciende ────────────────
  useEffect(() => {
    const actual = GUION[paso % GUION.length];
    const irse = setTimeout(() => setVisible(false), actual.ms - 500);
    const cambiar = setTimeout(() => {
      setPaso((p) => (p + 1) % GUION.length);
      setVisible(true);
    }, actual.ms);
    return () => { clearTimeout(irse); clearTimeout(cambiar); };
  }, [paso]);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/expovino/pantalla?campana=${encodeURIComponent(campana)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d: Datos = await r.json();
      setDatos((prev) => {
        if (prev && d.total > prev.total) {
          setSubio(true);
          setTimeout(() => setSubio(false), 2000);
        }
        // Sorteo nuevo → gira la ruleta antes de revelar. En la primera carga
        // (prev null) no se gira: si la pantalla se reinicia a mitad del evento
        // no tiene por qué re-sortear algo que ya pasó.
        if (prev && d.sorteoId && d.sorteoId !== prev.sorteoId) {
          setRuletaDe(d.sorteoId);
        }
        return d;
      });
    } catch { /* la red de una feria se cae; se reintenta al siguiente ciclo */ }
  }, [campana]);

  useEffect(() => {
    void cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  const urlQR = `${CANONICAL_BASE_URL}/e`;
  const total = datos?.total ?? 0;
  const tamNumero = total >= 1000 ? 104 : 132;
  const escena = GUION[paso % GUION.length];

  // Al entrar alguien nuevo se fuerza la escena del evento: el destello no
  // sirve de nada si en ese momento se está mostrando otra cosa.
  useEffect(() => {
    if (subio && escena.tipo !== "evento") { setPaso(0); setVisible(true); }
  }, [subio, escena.tipo]);

  const fundido: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(10px)",
    transition: "opacity .5s ease, transform .5s ease",
  };

  return (
    <main style={{
      width: "100vw", height: "100vh", overflow: "hidden", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: ANCHO, height: ALTO, flexShrink: 0,
        transform: `scale(${escala})`, transformOrigin: "center center",
        background: escena.tipo === "producto" && escena.producto
          ? escena.producto.fondo
          : "linear-gradient(160deg,#0B0407 0%,#2A0D1B 55%,#0B0407 100%)",
        transition: "background 700ms ease",
        color: "#fff", position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
        padding: "18px 14px",
      }}>

        {escena.tipo === "evento" ? (
          /* ── Escena del evento: contador + QR ── */
          <div style={{ ...fundido, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", width: "100%" }}>
            <div style={{
              padding: "8px 20px", borderRadius: 999,
              background: CAMPANA.colorPrimario, color: CAMPANA.colorTexto,
              fontSize: 15, fontWeight: 900, letterSpacing: 1.6,
            }}>
              {CAMPANA.emoji} EXPOVINO 2026
            </div>

            <p style={{ margin: "30px 0 0", fontSize: 12, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.4 }}>
              YA SE INSCRIBIERON
            </p>
            <p style={{
              margin: "2px 0 0", fontSize: tamNumero, fontWeight: 900, lineHeight: 0.92,
              fontVariantNumeric: "tabular-nums",
              color: subio ? "#9DCC65" : "#fff",
              textShadow: subio ? "0 0 26px rgba(157,204,101,0.7)" : "none",
              transition: "color .5s ease, text-shadow .5s ease",
            }}>
              {total}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#cbd5e1", textAlign: "center", lineHeight: 1.3 }}>
              y participan por el<br />premio de la noche
            </p>

            {datos && datos.ultimos.length > 0 && (
              <div style={{ marginTop: 18, width: "100%" }}>
                <p style={{ margin: "0 0 7px", fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 1.4, textAlign: "center" }}>
                  RECIÉN LLEGARON
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
                  {datos.ultimos.slice(0, 3).map((n, i) => (
                    <span key={`${n}-${i}`} style={{
                      padding: "5px 14px", borderRadius: 999, maxWidth: "100%",
                      background: i === 0 ? "rgba(157,204,101,0.2)" : "rgba(255,255,255,0.07)",
                      border: `1px solid ${i === 0 ? "rgba(157,204,101,0.5)" : "rgba(255,255,255,0.12)"}`,
                      fontSize: 16, fontWeight: 800, color: i === 0 ? "#9DCC65" : "#cbd5e1",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: "auto", width: "100%", textAlign: "center" }}>
              <p style={{ margin: "0 0 10px", fontSize: 19, fontWeight: 900, lineHeight: 1.15 }}>
                Escanea<br />y participa
              </p>
              <div style={{ background: "#fff", padding: 10, borderRadius: 10, display: "inline-block" }}>
                <QRCode value={urlQR} size={168} />
              </div>
              <p style={{ margin: "9px 0 0", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
                30 segundos y estás dentro
              </p>
            </div>
          </div>
        ) : (
          /* ── Ficha de producto ── */
          <div style={{ ...fundido, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", width: "100%", textAlign: "center" }}>
            <p style={{
              margin: "4px 0 0", fontSize: 11, fontWeight: 900,
              color: escena.producto!.acento, letterSpacing: 2, lineHeight: 1.3,
            }}>
              {escena.producto!.marca}
            </p>

            {escena.producto!.logo && (
              <img src={escena.producto!.logo} alt=""
                style={{ height: 46, objectFit: "contain", marginTop: 14 }} />
            )}

            <p style={{
              margin: escena.producto!.logo ? "22px 0 0" : "46px 0 0",
              fontSize: 27, fontWeight: 900, lineHeight: 1.12,
              color: escena.producto!.texto, whiteSpace: "pre-line",
            }}>
              {escena.producto!.titular}
            </p>

            {/* La cifra es el argumento: se lee de lejos y es verificable. */}
            <p style={{
              margin: "34px 0 0", fontSize: 82, fontWeight: 900, lineHeight: 0.9,
              color: escena.producto!.acento, fontVariantNumeric: "tabular-nums",
              textShadow: `0 0 34px ${escena.producto!.acento}55`,
            }}>
              {escena.producto!.cifra}
            </p>
            <p style={{
              margin: "8px 0 0", fontSize: 13, fontWeight: 800,
              color: escena.producto!.texto, opacity: 0.75, letterSpacing: 0.6,
            }}>
              {escena.producto!.cifraPie}
            </p>

            <p style={{
              margin: "30px 0 0", fontSize: 14, fontWeight: 600, lineHeight: 1.5,
              color: escena.producto!.texto, opacity: 0.78, padding: "0 6px",
            }}>
              {escena.producto!.bajada}
            </p>

            <div style={{ marginTop: "auto", width: "100%" }}>
              <div style={{
                height: 1, width: "60%", margin: "0 auto 10px",
                background: `linear-gradient(90deg, transparent, ${escena.producto!.acento}55, transparent)`,
              }} />
              <img src="/logo-synaptech-claro.png" alt="SynapTech"
                style={{ height: 24, objectFit: "contain", opacity: 0.92 }} />
            </div>
          </div>
        )}

        {/* Firma permanente en la escena del evento */}
        {escena.tipo === "evento" && (
          <div style={{ marginTop: 14, width: "100%", textAlign: "center" }}>
            <div style={{
              height: 1, width: "60%", margin: "0 auto 10px",
              background: "linear-gradient(90deg, transparent, rgba(250,243,224,0.28), transparent)",
            }} />
            <p style={{ margin: "0 0 5px", fontSize: 9, fontWeight: 700, color: "rgba(250,243,224,0.4)", letterSpacing: 1.6 }}>
              DESARROLLADO POR
            </p>
            <img src="/logo-synaptech-claro.png" alt="SynapTech"
              style={{ height: 22, objectFit: "contain", opacity: 0.9 }} />
          </div>
        )}

        {/* Ruleta: se antepone al ganador mientras dura el giro */}
        {ruletaDe && datos?.ganador && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 6,
            background: "linear-gradient(160deg,#12060B 0%,#2A0D1B 55%,#12060B 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "0 12px",
          }}>
            <RuletaSorteo
              nombres={datos.nombresRuleta ?? []}
              ganador={datos.ganador.nombre}
              onTerminar={() => setRuletaDe(null)}
            />
          </div>
        )}

        {/* Ganador: tapa todo, sin importar en qué escena vaya la rotación */}
        {datos?.ganador && !ruletaDe && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 5,
            background: "linear-gradient(160deg,#2A0D1B 0%,#7B1E3A 55%,#2A0D1B 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: "0 16px",
          }}>
            <p style={{ margin: 0, fontSize: 72, lineHeight: 1 }}>🏆</p>
            <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 900, color: CAMPANA.colorTexto, letterSpacing: 2 }}>
              GANADOR
            </p>
            <p style={{
              margin: "10px 0 0", fontWeight: 900, lineHeight: 1.05, color: "#fff",
              fontSize: datos.ganador.nombre.length <= 6 ? 52
                : datos.ganador.nombre.length <= 9 ? 40
                : datos.ganador.nombre.length <= 12 ? 32 : 26,
              hyphens: "none", wordBreak: "keep-all", whiteSpace: "nowrap",
              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {datos.ganador.nombre}
            </p>
            {datos.ganador.premio && (
              <p style={{ margin: "16px 0 0", fontSize: 19, fontWeight: 800, color: "#FFD84D", lineHeight: 1.25 }}>
                {datos.ganador.premio}
              </p>
            )}
            <p style={{ margin: "22px 0 0", fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.35 }}>
              Acércate al mostrador<br />del Club Patio
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
