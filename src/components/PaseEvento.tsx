"use client";

/**
 * Entrega del pase de wallet justo después de inscribirse en un evento.
 *
 * Se diseña para el peor contexto de uso posible, que es el real: una feria de
 * vinos de noche, con el asistente algo bebido, poca luz, ruido y gente
 * esperando detrás. Eso manda sobre todo lo demás:
 *
 *  · UNA acción. No se le pregunta Apple o Google — se detecta el teléfono y se
 *    muestra el botón que corresponde. Elegir es una decisión más, y cada
 *    decisión pierde gente.
 *  · El pase se pide al montar, mientras la persona lee. Cuando toca el botón
 *    ya está listo: cero espera con el dedo en la pantalla.
 *  · Texto mínimo y enorme. Nadie lee un párrafo en ese estado.
 *  · Botón alto y de ancho completo, que se acierta sin puntería.
 *
 * Si la detección falla o el pase de su sistema no salió, muestra los dos —
 * mejor dos botones que ninguno.
 */

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { esIOS } from "@/lib/pushSoporte";
import { Loader2, Wallet, Check } from "lucide-react";

type Pases = { saveUrlGoogle: string | null; urlApple: string | null };

export function PaseEvento({
  titulo = "Guarda tu pase",
  bajada = "Así te avisamos si ganas el sorteo y te enteras de los beneficios del Club.",
}: {
  titulo?: string;
  bajada?: string;
}) {
  const [pases, setPases] = useState<Pases | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "sin_pase">("cargando");
  const [ios, setIos] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => { setIos(esIOS()); }, []);

  // Se pide apenas hay sesión, sin esperar a que la persona toque nada.
  const pedirPase = useCallback(async (intento = 1) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const r = await fetch("/api/expovino/wallet", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (r.status === 503) { setEstado("sin_pase"); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "error");
      if (!d.saveUrlGoogle && !d.urlApple) { setEstado("sin_pase"); return; }
      setPases({ saveUrlGoogle: d.saveUrlGoogle, urlApple: d.urlApple });
      setEstado("listo");
    } catch {
      // La red de una feria falla; un reintento cubre casi todos los casos.
      if (intento < 2) { setTimeout(() => pedirPase(intento + 1), 1500); return; }
      setEstado("sin_pase");
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => { if (u) void pedirPase(); });
    return () => unsub();
  }, [pedirPase]);

  if (estado === "sin_pase") return null;

  const urlPropia = ios ? pases?.urlApple : pases?.saveUrlGoogle;
  const urlOtra = ios ? pases?.saveUrlGoogle : pases?.urlApple;
  const etiquetaPropia = ios ? "Agregar a Apple Wallet" : "Agregar a Google Wallet";
  const etiquetaOtra = ios ? "Usar Google Wallet" : "Usar Apple Wallet";

  return (
    <section style={{
      borderRadius: 24, padding: "24px 20px", textAlign: "center",
      background: "linear-gradient(160deg, rgba(211,182,115,0.16), rgba(123,30,58,0.22))",
      border: "1px solid rgba(211,182,115,0.45)",
    }}>
      <div style={{
        width: 52, height: 52, margin: "0 auto 14px", borderRadius: 16,
        background: "rgba(211,182,115,0.22)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {guardado
          ? <Check style={{ width: 26, height: 26, color: "#9DCC65" }} />
          : <Wallet style={{ width: 26, height: 26, color: "#D3B673" }} />}
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>
        {guardado ? "¡Pase guardado!" : titulo}
      </h2>
      <p style={{ fontSize: 15, color: "#e2e8f0", margin: "0 0 20px", lineHeight: 1.5 }}>
        {guardado
          ? "Lo tienes en tu billetera. Si ganas, te avisamos ahí mismo."
          : bajada}
      </p>

      {/* Botón principal: alto, ancho completo, sin nada que lo compita */}
      <a
        href={urlPropia ?? undefined}
        onClick={() => { if (urlPropia) setGuardado(true); }}
        aria-disabled={!urlPropia}
        target={ios ? undefined : "_blank"}
        rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          height: 62, borderRadius: 18, textDecoration: "none",
          background: urlPropia ? "#fff" : "rgba(255,255,255,0.25)",
          color: "#1a1a2e", fontSize: 18, fontWeight: 900,
          pointerEvents: urlPropia ? "auto" : "none",
          boxShadow: urlPropia ? "0 6px 24px rgba(0,0,0,0.35)" : "none",
          transition: "transform .15s ease",
        }}
        className="active:scale-[0.97]"
      >
        {estado === "cargando"
          ? <><Loader2 style={{ width: 20, height: 20 }} className="animate-spin" /> Preparando…</>
          : <><Wallet style={{ width: 21, height: 21 }} /> {etiquetaPropia}</>}
      </a>

      {/* La otra plataforma queda accesible pero discreta: no compite. */}
      {urlOtra && (
        <a href={urlOtra} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-block", marginTop: 14, fontSize: 12.5,
            color: "rgba(255,255,255,0.55)", textDecoration: "underline",
          }}>
          {etiquetaOtra}
        </a>
      )}
    </section>
  );
}
