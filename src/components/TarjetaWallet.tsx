"use client";

/**
 * Botones para agregar la tarjeta del Club a Apple Wallet y Google Wallet.
 *
 * Un pase de wallet llega a la pantalla de bloqueo sin pedir permiso de
 * notificaciones y sin instalar nada — al contrario del push del navegador, que
 * en iPhone exige agregar la PWA a la pantalla de inicio y aun así lo tiene el
 * 9% de los socios.
 *
 * Se muestra primero el botón del sistema del propio teléfono: en un evento con
 * cola, dos botones iguales hacen dudar; el orden correcto quita esa duda.
 */

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { esIOS } from "@/lib/pushSoporte";
import { Loader2, Wallet, AlertCircle } from "lucide-react";

type Pases = { saveUrlGoogle: string | null; urlApple: string | null };

export function TarjetaWallet() {
  const [pases, setPases] = useState<Pases | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => { setIos(esIOS()); }, []);

  const emitir = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setCargando(false); return; }
    try {
      const r = await fetch("/api/expovino/wallet", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (r.status === 503) { setCargando(false); return; }   // no configurado: no se ofrece
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "error");
      setPases({ saveUrlGoogle: d.saveUrlGoogle, urlApple: d.urlApple });
    } catch (e: any) {
      setError(String(e?.message ?? "error"));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => { if (u) void emitir(); else setCargando(false); });
    return () => unsub();
  }, [emitir]);

  if (cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#64748b" }} />
      </div>
    );
  }

  // Si no hay ningún pase (no configurado o falló), no se ocupa espacio con algo
  // que el socio no puede resolver.
  if (!pases?.saveUrlGoogle && !pases?.urlApple) {
    if (!error) return null;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 0" }}>
        <AlertCircle style={{ width: 16, height: 16, color: "#94a3b8", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
          La tarjeta no está disponible en este momento. Tus sellos siguen
          guardados en la app.
        </p>
      </div>
    );
  }

  const botonApple = pases.urlApple && (
    <a key="apple" href={pases.urlApple}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        height: 48, borderRadius: 14, background: "#000", color: "#fff",
        fontSize: 14, fontWeight: 800, textDecoration: "none",
        border: "1px solid rgba(255,255,255,0.22)",
      }}>
      <Wallet style={{ width: 17, height: 17 }} />
      Agregar a Apple Wallet
    </a>
  );

  const botonGoogle = pases.saveUrlGoogle && (
    <a key="google" href={pases.saveUrlGoogle} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        height: 48, borderRadius: 14, background: "#fff", color: "#1f2937",
        fontSize: 14, fontWeight: 800, textDecoration: "none",
      }}>
      <Wallet style={{ width: 17, height: 17 }} />
      Agregar a Google Wallet
    </a>
  );

  // El del sistema propio primero: en un mostrador con cola, dudar cuesta.
  const orden = ios ? [botonApple, botonGoogle] : [botonGoogle, botonApple];

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {orden.filter(Boolean)}
      <p style={{ fontSize: 10.5, color: "#64748b", margin: "2px 0 0", lineHeight: 1.45, textAlign: "center" }}>
        Queda en el celular, sin instalar nada
      </p>
    </div>
  );
}
