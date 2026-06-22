import Link from "next/link";
import { Sparkles, MapPin } from "lucide-react";
import { adminDb } from "@/lib/firebaseAdmin";
import { PREMIOS as PREMIOS_FALLBACK } from "@/lib/data";
import UTMTracker from "@/components/UTMTracker";
import StickyCta from "./StickyCta";

const GOLD = "#D3B673";

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

  const localesAsociados = locales.filter((l: any) => l.tipo === "asociado");
  const localesEmprendedores = locales.filter((l: any) => l.tipo !== "asociado");
  const hayAsociados = localesAsociados.length > 0;

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto [-webkit-overflow-scrolling:touch] text-slate-50 bg-[#0f172a] bg-[radial-gradient(at_10%_10%,rgba(211,182,115,0.12)_0px,transparent_55%),radial-gradient(at_90%_90%,rgba(157,204,101,0.08)_0px,transparent_55%)] font-[family-name:'PT_Sans',-apple-system,system-ui,sans-serif]">
      {/* Blobs */}
      <div className="fixed rounded-full pointer-events-none opacity-10 blur-[40px] w-[280px] h-[280px] -top-20 -right-[60px] bg-[#D3B673]" />
      <div className="fixed rounded-full pointer-events-none opacity-10 blur-[40px] w-[180px] h-[180px] bottom-[60px] -left-[50px] bg-[#9DCC65]" />

      <UTMTracker />
      <div className="relative z-[1] max-w-[440px] mx-auto pb-[100px]">

        {/* ── HERO ── */}
        <section className="pt-12 px-6 pb-7 text-center">
          <div className="relative w-full max-w-xs mx-auto aspect-video rounded-3xl overflow-hidden bg-gray-900 shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/10 mb-8 animate-fade-in-up">
            <video
              src="/descubre.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              className="w-full h-full object-cover"
            />
          </div>

          <h1 className="text-3xl font-black leading-[1.2] mb-3 bg-gradient-to-br from-[#D3B673] to-[#F2D59B] bg-clip-text text-transparent">
            Descubre el Club Patio
          </h1>

          <p className="text-[15px] text-slate-400 leading-[1.65] mb-7 px-2">
            Acumula sellos en los locales de Patio Curauma y canjéalos por premios reales.
            <br /><strong className="text-slate-50">Es gratis, es tuyo.</strong>
          </p>

          {/* Prueba social (FOMO) */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex">
              <div className="bg-gray-400 border-2 border-[#0f172a] rounded-full w-6 h-6" />
              <div className="bg-gray-500 border-2 border-[#0f172a] rounded-full w-6 h-6 -ml-2" />
              <div className="bg-gray-300 border-2 border-[#0f172a] rounded-full w-6 h-6 -ml-2" />
            </div>
            <span className="text-sm text-gray-300 font-medium">
              🔥 +500 vecinos ya disfrutan sus recompensas
            </span>
          </div>

          {/* Tarjeta de sellos preview */}
          <div className="bg-slate-800/60 backdrop-blur-[20px] border border-[#D3B673]/20 rounded-[20px] py-[18px] px-5 mb-6 text-left">
            <p className="text-[10px] font-extrabold text-[#9DCC65] uppercase tracking-[1.5px] mb-3">
              Tu tarjeta de sellos ✦
            </p>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square flex items-center justify-center">
                  <img src="/Logo2.png" alt=""
                    className={`w-full h-full object-contain${i >= 3 ? " opacity-40 brightness-75 hover:opacity-60 transition-opacity" : ""}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-2.5 font-semibold">
              3 de 10 sellos — ¡el próximo podría ser tuyo!
            </p>
          </div>

          <Link href={ctaHref} className="flex items-center justify-center gap-2 w-full h-14 bg-gradient-to-br from-[#D3B673] to-[#BFA05C] text-slate-900 font-black text-base rounded-[18px] shadow-[0_8px_24px_rgba(211,182,115,0.38)] no-underline">
            <Sparkles size={20} />
            Quiero unirme gratis →
          </Link>
        </section>

        {/* ── CÓMO FUNCIONA ── */}
        <section className="px-6 pb-8">
          <SectionTitle sub="Mira la app en acción">¿Cómo funciona?</SectionTitle>

          {/* Mockup de celular con video demostrativo */}
          <div className="relative mx-auto w-full max-w-[280px] aspect-[9/16] bg-gray-900 rounded-[2.5rem] border-[8px] border-gray-900 shadow-2xl overflow-hidden ring-1 ring-white/10 mb-8 animate-fade-in-up">
            {/* Notch / Dynamic Island */}
            <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-3xl w-1/2 mx-auto z-20" />
            <video
              src="/descubre2.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              className="absolute inset-0 w-full h-full object-cover z-10"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {[
              { icon: "🏪", title: "Visita un local", desc: "Compra en cualquier local participante de Patio Curauma." },
              { icon: "⭐", title: "Gana un sello", desc: "El local escanea tu QR y acredita el sello al instante." },
              { icon: "🎁", title: "Canjea tu premio", desc: "Cuando tengas suficientes sellos, elige el premio que quieras." },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-4 bg-slate-800/45 backdrop-blur-[16px] border border-white/[0.06] rounded-2xl p-4">
                <div className="w-12 h-12 rounded-[14px] flex-shrink-0 text-[22px] bg-gradient-to-br from-[#D3B673]/20 to-[#D3B673]/[0.07] border border-[#D3B673]/[0.22] flex items-center justify-center">{item.icon}</div>
                <div>
                  <p className="text-sm font-extrabold text-slate-50 mb-0.5">{item.title}</p>
                  <p className="text-xs text-slate-500 leading-[1.4]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PREMIOS ── */}
        <section className="px-6 pb-8">
          <SectionTitle sub="Reales. Actualizados. Te esperan.">Premios disponibles</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {premios.slice(0, 6).map((p: any) => (
              <div key={p.id} className={`relative flex flex-col items-center text-center gap-2 bg-slate-800/55 backdrop-blur-[16px] rounded-2xl px-3 py-4 border ${p.esSorteo ? "border-[#D3B673]/35" : "border-white/[0.07]"}`}>
                {p.esSorteo && (
                  <div className="absolute top-2 right-2 bg-gradient-to-br from-[#D3B673] to-[#BFA05C] rounded-md px-1.5 py-0.5 text-[9px] font-extrabold text-slate-900 uppercase tracking-[0.5px]">Sorteo</div>
                )}
                <div className={`w-12 h-12 rounded-[14px] text-2xl flex items-center justify-center ${p.esSorteo ? "bg-gradient-to-br from-[#D3B673]/25 to-[#D3B673]/10 border border-[#D3B673]/30" : "bg-gradient-to-br from-[#9DCC65]/20 to-[#9DCC65]/[0.08] border border-[#9DCC65]/20"}`}>
                  {p.icono && /\p{Emoji}/u.test(p.icono) ? p.icono : p.esSorteo ? "🎟️" : "🎁"}
                </div>
                <p className="text-xs font-bold text-slate-50 leading-[1.3]">
                  {p.nombre}
                </p>
                <div className="flex items-center gap-1 bg-[#9DCC65]/[0.12] rounded-lg px-2 py-[3px]">
                  <img src="/Logo2.png" alt="" className="w-[13px] h-[13px] object-contain" />
                  <span className="text-[11px] font-extrabold text-[#9DCC65]">
                    {p.sellosRequeridos ?? p.costo ?? "?"} sellos
                  </span>
                </div>
                {p.vendorNombre && (
                  <p className="text-[10px] text-slate-600">{p.vendorNombre}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── LOCALES ── */}
        {locales.length > 0 && (
          hayAsociados ? (
            <section className="pb-8 space-y-5">
              {/* Comercios Asociados (arriba, destacados) */}
              <div>
                <div className="px-6">
                  <SectionTitle sub="Suma sellos con tu boleta, al instante">🏪 Comercios Asociados</SectionTitle>
                </div>
                <LocalesRow locales={localesAsociados} />
              </div>
              {/* Emprendedores (abajo) */}
              {localesEmprendedores.length > 0 && (
                <div>
                  <div className="px-6">
                    <SectionTitle sub="Gana sellos en cada compra">🎨 Emprendedores</SectionTitle>
                  </div>
                  <LocalesRow locales={localesEmprendedores} />
                </div>
              )}
            </section>
          ) : (
            <section className="pb-8">
              <div className="px-6">
                <SectionTitle sub="Gana sellos en todos estos locales">Locales participantes</SectionTitle>
              </div>
              <LocalesRow locales={locales} />
            </section>
          )
        )}

        {/* ── BENEFICIOS (Bento Box) ── */}
        <section className="px-6 pb-8">
          <h3 className="text-[15px] font-extrabold text-[#9DCC65] mb-4">¿Por qué unirte?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Beneficio destacado a ancho completo */}
            <div className="md:col-span-2 bg-gradient-to-br from-[#111111] to-gray-900 border border-white/10 rounded-2xl p-6 animate-fade-in-up">
              <div className="text-3xl mb-3">📱</div>
              <p className="text-base font-bold text-slate-50 mb-1">Todo desde tu celular</p>
              <p className="text-[13px] text-slate-400 leading-relaxed">
                Sin tarjeta física. Tu club entero vive en tu bolsillo, siempre a mano.
              </p>
            </div>
            {[
              { icon: "🔔", text: "Notificaciones de nuevos premios y sorteos" },
              { icon: "🎟️", text: "Participa en sorteos exclusivos del club" },
              { icon: "💳", text: "Compatible con Google Wallet" },
              { icon: "🏆", text: "Recompensas reales en tus locales favoritos" },
            ].map((b, i) => (
              <div key={i} className="bg-slate-800/45 border border-white/[0.06] rounded-2xl p-5 animate-fade-in-up">
                <div className="text-2xl mb-2">{b.icon}</div>
                <p className="text-[13px] text-slate-300 leading-snug">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── UBICACIÓN ── */}
        <section className="px-6 pb-8">
          <div className="flex items-center gap-3 bg-slate-800/45 border border-white/[0.06] rounded-2xl px-4 py-3.5">
            <div className="w-10 h-10 rounded-xl flex-shrink-0 bg-[#D3B673]/[0.12] border border-[#D3B673]/20 flex items-center justify-center">
              <MapPin size={18} color={GOLD} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-50 mb-0.5">Patio Curauma</p>
              <p className="text-[11px] text-slate-600">Av. Lomas de la Luz 4650, Curauma, Valparaíso</p>
            </div>
          </div>
        </section>

        {/* ── INCENTIVO DE BIENVENIDA ── */}
        <div className="mx-6 mb-6 rounded-2xl border border-[#8CC63F]/30 bg-[#8CC63F]/5 p-4 text-center animate-fade-in-up">
          <p className="text-sm font-semibold text-slate-100 leading-relaxed">
            🎁 Tu primer sello va por nuestra cuenta.{" "}
            <span className="text-[#8CC63F] font-bold">Arranca con ventaja.</span>
          </p>
        </div>

        {/* ── CTA FINAL ── */}
        <section id="cta-final" className="px-6 pb-5 text-center">
          <h2 className="text-[22px] font-black text-slate-50 mb-1.5">
            ¿Listo para empezar?
          </h2>
          <p className="text-[13px] text-slate-500 mb-5">
            Gratis. Sin cuotas. Sin compromisos.
          </p>
          <Link href={ctaHref} className="flex items-center justify-center gap-2 w-full h-14 bg-gradient-to-br from-[#D3B673] to-[#BFA05C] text-slate-900 font-black text-base rounded-[18px] shadow-[0_8px_24px_rgba(211,182,115,0.38)] no-underline">
            <Sparkles size={20} />
            Crear mi cuenta gratis
          </Link>
          <Link href={ctaHref} className="flex items-center justify-center mt-3.5 text-[13px] text-slate-600 no-underline">
            ¿Ya tengo cuenta?&nbsp;<strong className="text-[#D3B673] font-bold">Iniciar sesión →</strong>
          </Link>
        </section>

        <p className="text-[11px] text-slate-800 text-center px-6 pb-4">
          Club Patio Curauma © {new Date().getFullYear()}
        </p>
      </div>

      {/* Smart Sticky CTA inferior (cliente — se oculta sobre #cta-final) */}
      <StickyCta href={ctaHref} watchId="cta-final" />
    </div>
  );
}

function LocalCard({ local }: { local: any }) {
  const asociado = local.tipo === "asociado";
  return (
    <div className="relative flex-shrink-0 w-28 flex flex-col items-center text-center bg-slate-800/60 border border-white/[0.07] rounded-2xl p-3">
      {asociado && (
        <span className="absolute top-1.5 right-1.5 text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#5BB8D4]/20 text-[#7FD0E6]">
          Asociado
        </span>
      )}
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center p-2 mb-3 shadow-md">
        <img
          src={local.imagenTarjeta || local.imagenPerfil}
          alt={local.businessName || local.name || "Local"}
          className="w-full h-full object-contain rounded-full"
        />
      </div>
      <p className="text-[11px] font-bold text-slate-50 mb-0.5 leading-[1.3]">
        {local.businessName || local.name}
      </p>
      {local.category && (
        <p className="text-[10px] text-[#D3B673] capitalize">{local.category}</p>
      )}
    </div>
  );
}

function LocalesRow({ locales }: { locales: any[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-6 pt-1 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
      {locales.map((local: any) => <LocalCard key={local.id} local={local} />)}
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center mb-4">
      <h2 className="text-lg font-extrabold text-slate-50 mb-1">{children}</h2>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
