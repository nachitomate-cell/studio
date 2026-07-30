"use client";

/**
 * Pantalla de aterrizaje para quien se inscribió desde el QR de Expovino.
 *
 * Cumple tres funciones en ese orden: confirmar que quedó dentro del sorteo,
 * dejar activadas las notificaciones —que es cómo se le avisará si gana— y
 * recién después invitarlo a usar el Club.
 *
 * El aviso del ganador sale por bandeja de la app, correo y push, así que nadie
 * se queda fuera por no haber activado nada; pero el push es el único que suena
 * en el momento, y en una feria eso es la diferencia entre enterarse o no.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { CAMPANAS } from "@/lib/campanas";
import { ActivarNotificaciones } from "@/components/ActivarNotificaciones";
import { TarjetaWallet } from "@/components/TarjetaWallet";
import { Button } from "@/components/ui/button";
import { EXPOSITORES } from "@/lib/expositoresExpovino";
import { Loader2, Trophy, Ticket, Store, CheckCircle2, Wine, Wallet } from "lucide-react";

const CAMPANA = CAMPANAS.expovino;

export default function ExpovinoPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [participa, setParticipa] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setCargando(false); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        const d = snap.data();
        setNombre(String(d?.nombre ?? "").trim().split(" ")[0] || "");
        setParticipa(d?.campanaRegistro === CAMPANA.slug);
      } catch { /* best-effort */ }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  if (cargando) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#12060B" }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: CAMPANA.colorTexto }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8" style={{ background: "linear-gradient(160deg,#12060B 0%,#2A0D1B 55%,#12060B 100%)" }}>
      <div className="mx-auto w-full max-w-md flex flex-col gap-4">

        {/* Cabecera */}
        <div className="text-center">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "6px 15px", borderRadius: 999, marginBottom: 14,
            background: CAMPANA.colorPrimario, color: CAMPANA.colorTexto,
            fontSize: 11.5, fontWeight: 800, letterSpacing: "1px",
          }}>
            <span aria-hidden style={{ fontSize: 14 }}>{CAMPANA.emoji}</span>
            {CAMPANA.nombre.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.2 }}>
            {nombre ? `¡Bienvenido, ${nombre}!` : "¡Bienvenido al Club!"}
          </h1>
        </div>

        {/* Estado en el sorteo */}
        <section style={{
          borderRadius: 22, padding: "22px 20px", textAlign: "center",
          background: participa ? "rgba(157,204,101,0.1)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${participa ? "rgba(157,204,101,0.35)" : "rgba(255,255,255,0.12)"}`,
        }}>
          {participa ? (
            <>
              <CheckCircle2 style={{ width: 44, height: 44, color: "#9DCC65", margin: "0 auto 12px" }} />
              <h2 style={{ fontSize: 19, fontWeight: 900, color: "#fff", margin: "0 0 6px" }}>
                Estás participando en el sorteo
              </h2>
              <p style={{ fontSize: 13, color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>
                Ya quedaste inscrito. Al final de la noche sorteamos el premio entre
                todos los que se registraron hoy acá.
              </p>
            </>
          ) : (
            <>
              <Ticket style={{ width: 40, height: 40, color: CAMPANA.colorTexto, margin: "0 auto 12px" }} />
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: "0 0 6px" }}>
                Escanea el código del stand
              </h2>
              <p style={{ fontSize: 13, color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>
                Para entrar al sorteo tienes que inscribirte desde el QR que está
                en el mostrador de Patio Curauma.
              </p>
            </>
          )}
        </section>

        {/* Notificaciones: cómo se le avisa al ganador */}
        {participa && (
          <section style={{
            borderRadius: 22, padding: "18px 20px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Trophy style={{ width: 18, height: 18, color: "#D3B673" }} />
              <p style={{ fontSize: 14, fontWeight: 900, color: "#fff", margin: 0 }}>
                ¿Cómo sabrás si ganaste?
              </p>
            </div>
            <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "0 0 14px", lineHeight: 1.55 }}>
              Al ganador le avisamos por tres vías: un correo, un mensaje dentro
              de la app y una alerta en el teléfono.
            </p>
            <ActivarNotificaciones
              titulo={CAMPANA.avisoTitulo}
              descripcion={CAMPANA.avisoTexto}
            />
          </section>
        )}

        {/* Tarjeta en el wallet del teléfono */}
        {participa && (
          <section style={{
            borderRadius: 22, padding: "18px 20px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Wallet style={{ width: 18, height: 18, color: "#8FB8DE" }} />
              <p style={{ fontSize: 14, fontWeight: 900, color: "#fff", margin: 0 }}>
                Lleva tu tarjeta en el celular
              </p>
            </div>
            <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "0 0 14px", lineHeight: 1.55 }}>
              Tus sellos en la pantalla de bloqueo, sin abrir la app y sin
              instalar nada.
            </p>
            <TarjetaWallet />
          </section>
        )}

        {/* Directorio de expositores */}
        <section style={{
          borderRadius: 22, padding: "18px 20px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Wine style={{ width: 18, height: 18, color: "#E9AFC0" }} />
            <p style={{ fontSize: 14, fontWeight: 900, color: "#fff", margin: 0 }}>
              Quiénes están en la feria
            </p>
          </div>
          <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "0 0 14px", lineHeight: 1.55 }}>
            {EXPOSITORES.filter((e) => e.tipo === "vina").length} viñas, restaurantes,
            destilados, cervecerías y tiendas gourmet — {EXPOSITORES.length} expositores
            en total. Búscalos por nombre y mira el plano del recinto.
          </p>
          <Button onClick={() => router.push("/expovino/expositores")}
            className="w-full h-12 rounded-2xl font-black text-sm"
            style={{ background: CAMPANA.colorPrimario, color: CAMPANA.colorTexto, border: "none" }}>
            Ver expositores y plano
          </Button>
        </section>

        {/* Qué hacer mientras tanto */}
        <section style={{
          borderRadius: 22, padding: "18px 20px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Store style={{ width: 18, height: 18, color: "#9DCC65" }} />
            <p style={{ fontSize: 14, fontWeight: 900, color: "#fff", margin: 0 }}>
              Tu Club parte hoy
            </p>
          </div>
          <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "0 0 14px", lineHeight: 1.55 }}>
            Ya tienes tu primer sello. Junta sellos comprando en los locales de
            Patio Curauma y canjéalos por premios.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <Button onClick={() => router.push("/premios")}
              className="w-full h-12 rounded-2xl font-black text-sm"
              style={{ background: "linear-gradient(135deg,#9DCC65,#7ab84e)", color: "#fff", border: "none" }}>
              Ver los premios
            </Button>
            <Button onClick={() => router.push("/")} variant="ghost"
              className="w-full h-11 rounded-2xl font-bold text-sm"
              style={{ color: "#94a3b8" }}>
              Ir a mi tarjeta de sellos
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
