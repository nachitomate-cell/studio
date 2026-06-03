import Link from "next/link";
import { Sparkles, MapPin } from "lucide-react";
import { adminDb } from "@/lib/firebaseAdmin";
import { PREMIOS as PREMIOS_FALLBACK } from "@/lib/data";
import UTMTracker from "@/components/UTMTracker";

const GOLD = "#D3B673";
const GREEN = "#9DCC65";
const DARK = "#0f172a";

async function fetchPremios() {
  try {
    const snap = await adminDb
      .collection("premios")
      .where("activo", "==", true)
      .get();
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .sort((a, b) => (a.sellosRequeridos || 0) - (b.sellosRequeridos || 0));
    return items.length > 0 ? items : (PREMIOS_FALLBACK as any[]);
  } catch {
    return PREMIOS_FALLBACK as any[];
  }
}

async function fetchLocales() {
  try {
    const snap = await adminDb.collection("entrepreneur_profiles").get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter((x: any) => x.imagenTarjeta || x.imagenPerfil)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export default async function DescubrePage() {
  const [premios, locales] = await Promise.all([fetchPremios(), fetchLocales()]);

  const ctaHref = "/unete";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      overflowY: "auto", WebkitOverflowScrolling: "touch" as any,
      background: DARK,
      backgroundImage: `
        radial-gradient(at 10% 10%, rgba(211,182,115,0.12) 0px, transparent 55%),
        radial-gradient(at 90% 90%, rgba(157,204,101,0.08) 0px, transparent 55%)
      `,
      fontFamily: "'PT Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#f8fafc",
    }}>
      {/* Blobs */}
      <div style={{ position: "fixed", borderRadius: "50%", pointerEvents: "none", opacity: 0.10, filter: "blur(40px)", width: 280, height: 280, top: -80, right: -60, background: GOLD }} />
      <div style={{ position: "fixed", borderRadius: "50%", pointerEvents: "none", opacity: 0.10, filter: "blur(40px)", width: 180, height: 180, bottom: 60, left: -50, background: GREEN }} />

      <UTMTracker />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 440, margin: "0 auto", paddingBottom: 100 }}>

        {/* ── HERO ── */}
        <section style={{ padding: "48px 24px 28px", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "10px 24px", background: "rgba(30,41,59,0.55)",
            backdropFilter: "blur(16px)", borderRadius: 20,
            border: `1px solid rgba(211,182,115,0.25)`, marginBottom: 20,
          }}>
            <img src="/Logo3.webp" alt="Club Patio Curauma" style={{ height: 40, objectFit: "contain" }} />
          </div>

          <h1 style={{
            fontSize: 30, fontWeight: 900, lineHeight: 1.2, margin: "0 0 12px",
            background: `linear-gradient(135deg, ${GOLD}, #F2D59B)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Descubre el Club Patio
          </h1>

          <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.65, margin: "0 0 28px", padding: "0 8px" }}>
            Acumula sellos en los locales de Patio Curauma y canjéalos por premios reales.
            <br /><strong style={{ color: "#f8fafc" }}>Es gratis, es tuyo.</strong>
          </p>

          {/* Tarjeta de sellos preview */}
          <div style={{
            background: "rgba(30,41,59,0.6)", backdropFilter: "blur(20px)",
            border: `1px solid rgba(211,182,115,0.2)`, borderRadius: 20,
            padding: "18px 20px", marginBottom: 24, textAlign: "left",
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: GREEN, textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 12px" }}>
              Tu tarjeta de sellos ✦
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src="/Logo2.png" alt=""
                    style={{
                      width: "100%", height: "100%", objectFit: "contain",
                      ...(i >= 3 ? { filter: "grayscale(100%) opacity(18%)" } : {}),
                    }}
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#475569", marginTop: 10, fontWeight: 600 }}>
              3 de 10 sellos — ¡el próximo podría ser tuyo!
            </p>
          </div>

          <Link href={ctaHref} style={ctaStyle(true)}>
            <Sparkles size={20} />
            Quiero unirme gratis →
          </Link>
        </section>

        {/* ── CÓMO FUNCIONA ── */}
        <section style={{ padding: "0 24px 32px" }}>
          <SectionTitle>¿Cómo funciona?</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "🏪", title: "Visita un local", desc: "Compra en cualquier local participante de Patio Curauma." },
              { icon: "⭐", title: "Gana un sello", desc: "El local escanea tu QR y acredita el sello al instante." },
              { icon: "🎁", title: "Canjea tu premio", desc: "Cuando tengas suficientes sellos, elige el premio que quieras." },
            ].map(item => (
              <div key={item.title} style={cardStyle}>
                <div style={iconBoxStyle}>{item.icon}</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", margin: "0 0 2px" }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PREMIOS ── */}
        <section style={{ padding: "0 24px 32px" }}>
          <SectionTitle sub="Reales. Actualizados. Te esperan.">Premios disponibles</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {premios.slice(0, 6).map((p: any) => (
              <div key={p.id} style={{
                background: "rgba(30,41,59,0.55)", backdropFilter: "blur(16px)",
                border: p.esSorteo ? `1px solid rgba(211,182,115,0.35)` : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "16px 12px",
                display: "flex", flexDirection: "column", alignItems: "center",
                textAlign: "center", gap: 8, position: "relative",
              }}>
                {p.esSorteo && (
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    background: `linear-gradient(135deg, ${GOLD}, #BFA05C)`,
                    borderRadius: 6, padding: "2px 6px",
                    fontSize: 9, fontWeight: 800, color: DARK, textTransform: "uppercase", letterSpacing: "0.5px",
                  }}>Sorteo</div>
                )}
                <div style={{
                  width: 48, height: 48, borderRadius: 14, fontSize: 24,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: p.esSorteo
                    ? "linear-gradient(135deg, rgba(211,182,115,0.25), rgba(211,182,115,0.1))"
                    : "linear-gradient(135deg, rgba(157,204,101,0.2), rgba(157,204,101,0.08))",
                  border: p.esSorteo ? `1px solid rgba(211,182,115,0.3)` : `1px solid rgba(157,204,101,0.2)`,
                }}>
                  {p.icono && /\p{Emoji}/u.test(p.icono) ? p.icono : p.esSorteo ? "🎟️" : "🎁"}
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", margin: 0, lineHeight: 1.3 }}>
                  {p.nombre}
                </p>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "rgba(157,204,101,0.12)", borderRadius: 8, padding: "3px 8px",
                }}>
                  <img src="/Logo2.png" alt="" style={{ width: 13, height: 13, objectFit: "contain" }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: GREEN }}>
                    {p.sellosRequeridos ?? p.costo ?? "?"} sellos
                  </span>
                </div>
                {p.vendorNombre && (
                  <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>{p.vendorNombre}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── LOCALES ── */}
        {locales.length > 0 && (
          <section style={{ padding: "0 0 32px" }}>
            <div style={{ padding: "0 24px" }}>
              <SectionTitle sub="Gana sellos en todos estos locales">Locales participantes</SectionTitle>
            </div>
            <div style={{
              display: "flex", gap: 12, overflowX: "auto",
              padding: "4px 24px 8px", scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch" as any,
            }}>
              {locales.map((local: any) => (
                <div key={local.id} style={{
                  flexShrink: 0, width: 128,
                  background: "rgba(30,41,59,0.6)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16, overflow: "hidden",
                }}>
                  <div style={{ width: "100%", height: 88, overflow: "hidden" }}>
                    <img
                      src={local.imagenTarjeta || local.imagenPerfil}
                      alt={local.businessName || local.name || "Local"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ padding: "9px 10px 11px" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc", margin: "0 0 2px", lineHeight: 1.3 }}>
                      {local.businessName || local.name}
                    </p>
                    {local.category && (
                      <p style={{ fontSize: 10, color: GOLD, margin: 0, textTransform: "capitalize" }}>
                        {local.category}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── BENEFICIOS ── */}
        <section style={{ padding: "0 24px 32px" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(157,204,101,0.12), rgba(157,204,101,0.04))",
            border: `1px solid rgba(157,204,101,0.2)`, borderRadius: 20, padding: "20px",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: GREEN, margin: "0 0 14px" }}>¿Por qué unirte?</h3>
            {[
              "🎁  Primer sello de regalo al registrarte",
              "📱  Todo desde tu celular, sin tarjeta física",
              "🔔  Notificaciones de nuevos premios y sorteos",
              "🎟️  Participa en sorteos exclusivos del club",
              "💳  Compatible con Google Wallet",
            ].map((b, i) => (
              <p key={i} style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.5 }}>{b}</p>
            ))}
          </div>
        </section>

        {/* ── UBICACIÓN ── */}
        <section style={{ padding: "0 24px 32px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(30,41,59,0.45)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16, padding: "14px 16px",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `rgba(211,182,115,0.12)`, border: `1px solid rgba(211,182,115,0.2)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MapPin size={18} color={GOLD} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", margin: "0 0 2px" }}>Patio Curauma</p>
              <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>Av. Lomas de la Luz 4650, Curauma, Valparaíso</p>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section style={{ padding: "0 24px 20px", textAlign: "center" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "#f8fafc", margin: "0 0 6px" }}>
            ¿Listo para empezar?
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>
            Gratis. Sin cuotas. Sin compromisos.
          </p>
          <Link href={ctaHref} style={ctaStyle(true)}>
            <Sparkles size={20} />
            Crear mi cuenta gratis
          </Link>
          <Link href={ctaHref} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: 14, fontSize: 13, color: "#475569", textDecoration: "none",
          }}>
            ¿Ya tengo cuenta?&nbsp;<strong style={{ color: GOLD, fontWeight: 700 }}>Iniciar sesión →</strong>
          </Link>
        </section>

        <p style={{ fontSize: 11, color: "#1e293b", textAlign: "center", padding: "0 24px 16px" }}>
          Club Patio Curauma © {new Date().getFullYear()}
        </p>
      </div>

      {/* Sticky CTA inferior */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        padding: "12px 20px calc(12px + env(safe-area-inset-bottom, 0px))",
        background: "linear-gradient(to top, rgba(15,23,42,0.98) 70%, transparent)",
        backdropFilter: "blur(8px)",
      }}>
        <Link href={ctaHref} style={ctaStyle(false)}>
          <Sparkles size={18} />
          Unirme al Club — Es gratis
        </Link>
      </div>
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", margin: "0 0 4px" }}>{children}</h2>
      {sub && <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{sub}</p>}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 16,
  background: "rgba(30,41,59,0.45)", backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 16,
};

const iconBoxStyle: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 14, flexShrink: 0, fontSize: 22,
  background: "linear-gradient(135deg, rgba(211,182,115,0.2), rgba(211,182,115,0.07))",
  border: "1px solid rgba(211,182,115,0.22)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

function ctaStyle(tall: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", height: tall ? 56 : 50,
    background: "linear-gradient(135deg, #D3B673, #BFA05C)",
    color: "#0f172a", fontWeight: 900, fontSize: tall ? 16 : 15,
    borderRadius: tall ? 18 : 16, border: "none",
    boxShadow: "0 8px 24px rgba(211,182,115,0.38)",
    textDecoration: "none",
  };
}
