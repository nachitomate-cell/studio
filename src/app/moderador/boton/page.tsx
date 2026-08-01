"use client";

/**
 * Mando a distancia de la ruleta.
 *
 * Se opera desde el teléfono, de pie frente a la gente y con la otra mano
 * ocupada. De ahí las decisiones: un solo botón que ocupa media pantalla, sin
 * confirmaciones ni menús, y el estado de lo que queda siempre a la vista para
 * no tener que ir a mirar el panel.
 *
 * El botón se bloquea mientras dura el giro. Sin eso, un doble toque —o la
 * ansiedad de "no pasó nada"— dispara dos sorteos y se queman dos premios.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { canAccessModPanel } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Tv, Trophy, Gift } from "lucide-react";

/** Bloqueo mientras la pantalla gira y revela. */
const BLOQUEO_MS = 6500;

export default function BotonRuletaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [campana, setCampana] = useState("expovino");
  const [girando, setGirando] = useState(false);
  const [quedan, setQuedan] = useState<number | null>(null);
  const [ultimo, setUltimo] = useState<{
    nombre: string; premio: string;
    aviso?: { bandeja: boolean; push: boolean; correo: boolean };
  } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("campana");
    if (p) setCampana(p.trim().toLowerCase());
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

  const cargarEstado = useCallback(async () => {
    if (!autorizado) return;
    try {
      const u = auth.currentUser;
      if (!u) return;
      const r = await fetch(`/api/admin/campana/premios?campana=${encodeURIComponent(campana)}`, {
        headers: { Authorization: `Bearer ${await u.getIdToken()}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setQuedan(d.disponibles ?? 0);
    } catch { /* no crítico */ }
  }, [autorizado, campana]);

  useEffect(() => { void cargarEstado(); }, [cargarEstado]);

  const girar = async () => {
    setGirando(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sin sesión");
      const r = await fetch("/api/admin/campana/girar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` },
        body: JSON.stringify({ campana }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo girar");
      setQuedan(d.quedan);
      // El ganador se revela recién cuando la rueda frena. Mostrarlo al
      // responder el servidor le arruinaba la sorpresa justo a quien tiene el
      // teléfono en la mano y está anunciando frente a la gente.
      setTimeout(() => {
        setUltimo({ nombre: d.ganador.nombre, premio: d.premio, aviso: d.aviso });
        setGirando(false);
      }, BLOQUEO_MS);
    } catch (e: any) {
      toast({ variant: "destructive", title: "No se pudo girar", description: e?.message });
      setGirando(false);
    }
  };

  if (autorizado === null) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#0B0407" }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#D4AF37" }} />
      </main>
    );
  }
  if (!autorizado) return null;

  const sinPremios = quedan === 0;

  return (
    <main style={{
      minHeight: "100vh", padding: "24px 20px",
      background: "radial-gradient(120% 60% at 50% 0%, #3A0E1D 0%, #12060B 62%, #050203 100%)",
      display: "flex", flexDirection: "column",
    }}>
      <div className="mx-auto w-full max-w-sm flex flex-col flex-1">

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: "#D4AF37", letterSpacing: 2.4 }}>
            MANDO DE LA RULETA
          </p>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "rgba(250,243,224,0.55)" }}>
            campaña · {campana}
          </p>
        </div>

        <div style={{
          borderRadius: 20, padding: "16px 18px", marginBottom: 20,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,175,55,0.3)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Gift style={{ width: 22, height: 22, color: "#D4AF37", flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
              {quedan ?? "—"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(250,243,224,0.6)" }}>
              premios por entregar
            </p>
          </div>
        </div>

        {/* El botón: enorme, sin nada que compita */}
        <button
          onClick={girar}
          disabled={girando || sinPremios}
          style={{
            width: "100%", minHeight: 190, borderRadius: 28, border: "none",
            background: sinPremios
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(150deg, #D4AF37 0%, #B8860B 55%, #8B6914 100%)",
            color: sinPremios ? "rgba(255,255,255,0.45)" : "#2A0D1B",
            fontSize: 26, fontWeight: 900, letterSpacing: 0.5,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: sinPremios ? "none" : "0 12px 40px rgba(212,175,55,0.35)",
            opacity: girando ? 0.6 : 1,
            transition: "opacity .2s ease, transform .15s ease",
            cursor: sinPremios ? "default" : "pointer",
          }}
          className="active:scale-[0.97]"
        >
          {girando ? (
            <><Loader2 style={{ width: 40, height: 40 }} className="animate-spin" />Girando…</>
          ) : sinPremios ? (
            <><Trophy style={{ width: 40, height: 40 }} />Sin premios</>
          ) : (
            <><Sparkles style={{ width: 44, height: 44 }} />GIRAR</>
          )}
        </button>

        <p style={{ margin: "14px 0 0", fontSize: 12, color: "rgba(250,243,224,0.45)", textAlign: "center", lineHeight: 1.5 }}>
          {sinPremios
            ? "Agrega más premios desde el panel de sorteo."
            : "La pantalla gira sola al tocar. No toques dos veces."}
        </p>

        {/* Último resultado, para cantarlo sin mirar la pantalla */}
        {ultimo && (
          <div style={{
            marginTop: 22, borderRadius: 20, padding: "16px 18px", textAlign: "center",
            background: "linear-gradient(150deg, rgba(212,175,55,0.18), rgba(123,30,58,0.26))",
            border: "1px solid rgba(212,175,55,0.45)",
          }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: "#D4AF37", letterSpacing: 2 }}>
              ÚLTIMO GANADOR
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 21, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>
              {ultimo.nombre}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#FFD84D", lineHeight: 1.35 }}>
              {ultimo.premio}
            </p>
            {/* Por dónde se le avisó: si el correo falló hay que decírselo a
                viva voz, y esto lo dice sin tener que ir a revisar nada. */}
            {ultimo.aviso && (
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "rgba(250,243,224,0.65)" }}>
                {ultimo.aviso.correo ? "✓ correo" : "✗ correo"}
                {" · "}
                {ultimo.aviso.bandeja ? "✓ app" : "✗ app"}
                {" · "}
                {ultimo.aviso.push ? "✓ push" : "— sin push"}
              </p>
            )}
          </div>
        )}

        <a
          href={`/moderador/ruleta?campana=${encodeURIComponent(campana)}`}
          target="_blank" rel="noopener noreferrer"
          style={{
            marginTop: "auto", paddingTop: 24, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 700,
            color: "rgba(250,243,224,0.5)", textDecoration: "none",
          }}
        >
          <Tv style={{ width: 15, height: 15 }} />
          Abrir la ruleta en la pantalla
        </a>
      </div>
    </main>
  );
}
