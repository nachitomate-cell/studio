"use client";

/**
 * Ruleta de premios para proyectar en el tótem.
 *
 * Escucha `ruleta/{campana}` con onSnapshot: cuando el mando a distancia
 * (/moderador/boton) dispara un giro, esto reacciona al instante. Se usa
 * escucha en vivo y no polling porque el giro tiene que arrancar en el mismo
 * momento en que se aprieta el botón — medio segundo de retraso frente a una
 * sala mirando se nota.
 *
 * El ganador y el premio YA vienen decididos del servidor. La rueda calcula el
 * giro para aterrizar en el segmento correcto: es puesta en escena, no el
 * mecanismo. Si la animación decidiera, el resultado dependería de dónde frena
 * un navegador — imposible de auditar y trivial de manipular.
 *
 * Se dibuja sobre el lienzo fijo de 256×768 del tótem y se escala a la ventana.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { canAccessModPanel } from "@/lib/constants";
import { Loader2 } from "lucide-react";

const ANCHO = 256;
const ALTO = 768;
const DIAMETRO = 236;
const VUELTAS = 6;
const GIRO_MS = 5200;
const REVELAR_MS = GIRO_MS + 700;

type Estado = {
  segmentos: string[];
  indiceGanador: number;
  premio: string;
  ganadorPila: string;
  quedan: number;
  iniciadoEn: string;
};

const PALETA = [
  { fondo: "#7B1E3A", texto: "#FFF3E2" },
  { fondo: "#1E1033", texto: "#F3E8FF" },
  { fondo: "#9E2A4C", texto: "#FFF3E2" },
  { fondo: "#0F1B4C", texto: "#E8EEFF" },
  { fondo: "#5B1230", texto: "#FFE9D6" },
  { fondo: "#2A0D1B", texto: "#F8DCC8" },
];

export default function RuletaPage() {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [campana, setCampana] = useState("expovino");
  const [escala, setEscala] = useState(1);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [revelado, setRevelado] = useState(false);
  const ultimoGiro = useRef<string | null>(null);

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

  // ── Escucha en vivo del mando ─────────────────────────────────────────────
  useEffect(() => {
    if (!autorizado) return;
    const unsub = onSnapshot(doc(db, "ruleta", campana), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as Estado;
      setEstado(d);

      // Cada iniciadoEn distinto es una orden de girar. Al cargar la página se
      // registra el actual sin girar: si la pantalla se reinicia, no repite un
      // giro que ya pasó.
      if (ultimoGiro.current === null) { ultimoGiro.current = d.iniciadoEn; setRevelado(true); return; }
      if (d.iniciadoEn === ultimoGiro.current) return;
      ultimoGiro.current = d.iniciadoEn;

      const paso = 360 / d.segmentos.length;
      // Se acumula sobre el ángulo actual para que nunca gire hacia atrás.
      setRevelado(false);
      setGirando(true);
      setAngulo((prev) => {
        const base = Math.ceil(prev / 360) * 360;
        // Centro del segmento ganador bajo la aguja (arriba), con un pequeño
        // desvío para que no caiga siempre exacto al centro.
        const desvio = (Math.random() - 0.5) * paso * 0.5;
        return base + VUELTAS * 360 - (d.indiceGanador * paso + paso / 2) - desvio;
      });
      setTimeout(() => { setGirando(false); setRevelado(true); }, REVELAR_MS);
    });
    return () => unsub();
  }, [autorizado, campana]);

  if (autorizado === null) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B0407" }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#D4AF37" }} />
      </main>
    );
  }
  if (!autorizado) return null;

  const r = DIAMETRO / 2;
  const segmentos = estado?.segmentos ?? [];
  const paso = segmentos.length ? 360 / segmentos.length : 60;

  return (
    <main style={{
      width: "100vw", height: "100vh", overflow: "hidden", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: ANCHO, height: ALTO, flexShrink: 0,
        transform: `scale(${escala})`, transformOrigin: "center center",
        background: "radial-gradient(120% 70% at 50% 22%, #3A0E1D 0%, #12060B 62%, #050203 100%)",
        color: "#fff", position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
        padding: "22px 14px",
      }}>

        <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: "#D4AF37", letterSpacing: 2.4 }}>
          PREMIO DEL MOMENTO
        </p>
        <p style={{ margin: "5px 0 0", fontSize: 11, color: "rgba(250,243,224,0.5)" }}>
          {estado ? `${estado.quedan} premios por entregar` : "esperando…"}
        </p>

        {/* ── Rueda ── */}
        <div style={{ position: "relative", width: DIAMETRO, height: DIAMETRO, marginTop: 26 }}>
          {/* Halo que late mientras gira */}
          <div style={{
            position: "absolute", inset: -14, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,0.32) 0%, transparent 68%)",
            opacity: girando ? 1 : 0.35,
            transition: "opacity .6s ease",
            animation: girando ? "latido 1.1s ease-in-out infinite" : "none",
          }} />

          <div style={{
            position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, zIndex: 4,
            borderLeft: "13px solid transparent",
            borderRight: "13px solid transparent",
            borderTop: "24px solid #D4AF37",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.75))",
          }} />

          <svg
            width={DIAMETRO} height={DIAMETRO} viewBox={`0 0 ${DIAMETRO} ${DIAMETRO}`}
            style={{
              position: "relative", zIndex: 2,
              transform: `rotate(${angulo}deg)`,
              transition: girando ? `transform ${GIRO_MS}ms cubic-bezier(.09,.72,.06,1)` : "none",
              filter: "drop-shadow(0 6px 22px rgba(0,0,0,0.6))",
            }}
          >
            {segmentos.map((nombre, i) => {
              const a0 = (i * paso - 90) * (Math.PI / 180);
              const a1 = ((i + 1) * paso - 90) * (Math.PI / 180);
              const x0 = r + r * Math.cos(a0), y0 = r + r * Math.sin(a0);
              const x1 = r + r * Math.cos(a1), y1 = r + r * Math.sin(a1);
              const grande = paso > 180 ? 1 : 0;
              const c = PALETA[i % PALETA.length];
              const medio = i * paso + paso / 2;
              return (
                <g key={`${nombre}-${i}`}>
                  <path
                    d={`M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 ${grande} 1 ${x1} ${y1} Z`}
                    fill={c.fondo} stroke="rgba(212,175,55,0.5)" strokeWidth={1.4}
                  />
                  {/* Texto radial: se lee siguiendo el radio, que es lo único
                      que permite meter un nombre largo en una porción angosta. */}
                  <text
                    fill={c.texto} fontSize={10.5} fontWeight={800}
                    textAnchor="end" dominantBaseline="middle"
                    transform={`rotate(${medio} ${r} ${r})`}
                    x={r + r - 12} y={r}
                  >
                    {nombre.length > 22 ? `${nombre.slice(0, 21)}…` : nombre}
                  </text>
                </g>
              );
            })}
            <circle cx={r} cy={r} r={r - 1} fill="none" stroke="#D4AF37" strokeWidth={3.5} />
            <circle cx={r} cy={r} r={20} fill="#12060B" stroke="#D4AF37" strokeWidth={3} />
            <circle cx={r} cy={r} r={7} fill="#D4AF37" />
          </svg>
        </div>

        {/* ── Resultado ── */}
        <div style={{
          marginTop: "auto", width: "100%", textAlign: "center",
          opacity: revelado && estado ? 1 : 0,
          transform: revelado ? "translateY(0) scale(1)" : "translateY(14px) scale(.96)",
          transition: "opacity .5s ease, transform .5s cubic-bezier(.34,1.56,.64,1)",
        }}>
          {estado && (
            <>
              <div style={{
                borderRadius: 18, padding: "14px 12px",
                background: "linear-gradient(150deg, rgba(212,175,55,0.22), rgba(123,30,58,0.3))",
                border: "1px solid rgba(212,175,55,0.55)",
              }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: "#D4AF37", letterSpacing: 2 }}>
                  GANA
                </p>
                <p style={{
                  margin: "5px 0 0", fontWeight: 900, lineHeight: 1.08, color: "#fff",
                  fontSize: estado.ganadorPila.length <= 8 ? 40 : estado.ganadorPila.length <= 11 ? 32 : 26,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {estado.ganadorPila}
                </p>
                <div style={{ height: 1, margin: "11px auto", width: "70%", background: "rgba(212,175,55,0.4)" }} />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#FFD84D", lineHeight: 1.3 }}>
                  {estado.premio}
                </p>
              </div>
              <p style={{ margin: "11px 0 0", fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                Retíralo en el mostrador<br />del Club Patio Curauma
              </p>
            </>
          )}
        </div>

        <style>{`
          @keyframes latido {
            0%, 100% { opacity: .55; transform: scale(1); }
            50%      { opacity: 1;   transform: scale(1.06); }
          }
        `}</style>
      </div>
    </main>
  );
}
