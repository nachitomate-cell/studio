import Link from "next/link";
import { MapPin, ArrowRight, Smartphone, Bell, Ticket, Wallet } from "lucide-react";
import { adminDb } from "@/lib/firebaseAdmin";
import { PREMIOS as PREMIOS_FALLBACK } from "@/lib/data";
import UTMTracker from "@/components/UTMTracker";
import StickyCta from "./StickyCta";
import { fotoOptimizada } from "@/lib/imagen";

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

/** Cuántos locales se muestran por sección. */
const POR_SECCION = 12;

/**
 * Los locales llegan separados por sección, con cupo propio cada una.
 *
 * Antes se cortaban los primeros 10 del total y recién después se dividían en
 * asociados y emprendedores. Como el orden que devuelve Firestore es arbitrario,
 * los asociados casi nunca alcanzaban a entrar: de los 10 que se mostraban solo
 * uno lo era, y comercios como Magura quedaban en el puesto 40 de 54 sin
 * aparecer nunca, sin importar su categoría.
 *
 * Se ordena por nombre para que la lista sea estable entre visitas y no dependa
 * del orden interno de la base.
 */
async function fetchLocales() {
  try {
    const snap = await adminDb.collection("entrepreneur_profiles").get();
    const visibles = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      // Un local desactivado no debería aparecer: antes no se comprobaba.
      .filter((x: any) => (x.imagenTarjeta || x.imagenPerfil) && x.active !== false)
      .sort((a: any, b: any) =>
        String(a.businessName ?? a.nombre ?? "").localeCompare(String(b.businessName ?? b.nombre ?? ""), "es")
      );

    return {
      asociados: visibles.filter((x: any) => x.tipo === "asociado").slice(0, POR_SECCION),
      emprendedores: visibles.filter((x: any) => x.tipo !== "asociado").slice(0, POR_SECCION),
    };
  } catch {
    return { asociados: [], emprendedores: [] };
  }
}

/**
 * Socios reales para la prueba social. Antes decía "+500 vecinos" escrito a mano
 * con tres círculos grises de avatar: un número desactualizado (eran 1.252 el
 * 2026-10-04) y una decoración que se ve inventada. Se redondea hacia abajo a la
 * centena para que la frase siga siendo cierta. Conteo agregado: no lee los documentos.
 */
async function fetchSocios(): Promise<number | null> {
  try {
    const snap = await adminDb.collection("usuarios").count().get();
    const n = snap.data().count;
    return n >= 100 ? Math.floor(n / 100) * 100 : null;
  } catch {
    return null;
  }
}

/**
 * Sello de regalo al registrarse, con la misma regla que aplica /unete al crear
 * la cuenta. Si se apaga desde /moderador, la página deja de prometerlo.
 */
async function fetchSellosBienvenida(): Promise<number> {
  try {
    const cfg = (await adminDb.doc("configuracion/general").get()).data()?.selloBienvenida;
    if (cfg?.activo === false) return 0;
    return Number(cfg?.cantidad ?? 1);
  } catch {
    return 0;
  }
}

export default async function DescubrePage() {
  const [premios, locales, socios, sellosBienvenida] = await Promise.all([
    fetchPremios(), fetchLocales(), fetchSocios(), fetchSellosBienvenida(),
  ]);

  const ctaHref = "/unete";

  const localesAsociados = locales.asociados;
  const localesEmprendedores = locales.emprendedores;
  const hayAsociados = localesAsociados.length > 0;
  const totalLocales = localesAsociados.length + localesEmprendedores.length;

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
              // Sin poster el cuadro quedaba gris hasta que bajaba el video.
              poster="/header.webp"
              className="w-full h-full object-cover"
            />
          </div>

          <h1 className="text-[34px] font-black leading-[1.05] tracking-tight mb-3 text-white">
            Compra en el Patio y <span className="text-[#F0C84A]">gana premios</span>
          </h1>

          <p className="text-[15px] text-slate-300 leading-[1.6] mb-6 px-2">
            Escanea el QR del mostrador cuando compras y suma un sello. Ser socio no cuesta nada.
          </p>

          {/* Prueba social con el número real (antes "+500" escrito a mano y avatares grises) */}
          {socios && (
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-[34px] font-black leading-none text-[#9DCC65]">
                +{socios.toLocaleString("es-CL")}
              </span>
              <span className="text-left text-[13px] font-semibold leading-tight text-slate-300">
                vecinos ya tienen<br />su tarjeta del Club
              </span>
            </div>
          )}

          {/* Tarjeta de sellos preview */}
          <div className="bg-slate-800/60 backdrop-blur-[20px] border border-[#D3B673]/20 rounded-[20px] py-[18px] px-5 mb-6 text-left">
            <p className="text-xs font-bold text-slate-300 mb-3">
              Así se ve tu tarjeta
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
              3 de 10 sellos
            </p>
          </div>

          <Link id="cta-hero" href={ctaHref} className="flex items-center justify-center gap-2 w-full h-14 bg-[#F0C84A] text-[#2A1B00] font-black text-[17px] rounded-[18px] shadow-[0_10px_28px_rgba(240,200,74,0.4)] no-underline">
            Crear mi tarjeta gratis <ArrowRight size={19} />
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
          <SectionTitle sub="Lo que puedes canjear hoy con tus sellos">Premios</SectionTitle>
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
        {totalLocales > 0 && (
          hayAsociados ? (
            <section className="pb-8 space-y-5">
              {/* Comercios Asociados (arriba, destacados) */}
              <div>
                <div className="px-6">
                  <SectionTitle sub="Suma sellos con tu boleta">Comercios asociados</SectionTitle>
                </div>
                <LocalesRow locales={localesAsociados} />
              </div>
              {/* Emprendedores (abajo) */}
              {localesEmprendedores.length > 0 && (
                <div>
                  <div className="px-6">
                    <SectionTitle sub="Gana sellos en cada compra">Emprendedores</SectionTitle>
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
              <LocalesRow locales={localesEmprendedores} />
            </section>
          )
        )}

        {/* ── BENEFICIOS ──
            Antes era un mosaico de cinco cajas con un emoji grande cada una (el
            formato de landing genérica). Ahora cada beneficio lleva un color de la
            marca y un ícono, y dice algo concreto. */}
        <section className="px-6 pb-8">
          <h3 className="text-[22px] font-black tracking-tight text-white mb-4">Lo que te llevas</h3>
          <div className="space-y-2.5">
            {[
              { Icono: Smartphone, color: "#F0C84A", titulo: "Tu tarjeta en el celular", texto: "Sin cartón que se pierda: tus sellos quedan guardados." },
              { Icono: Bell, color: "#9DCC65", titulo: "Avisos al instante", texto: "Te llega una alerta con cada sello, premio o sorteo." },
              { Icono: Ticket, color: "#5BB8D4", titulo: "Sorteos para socios", texto: "Cada cierto tiempo se sortean premios entre los socios." },
              { Icono: Wallet, color: "#F0C84A", titulo: "Va a tu Google Wallet", texto: "Guárdala junto a tus otras tarjetas." },
            ].map(({ Icono, color, titulo, texto }) => (
              <div key={titulo} className="flex items-center gap-4 rounded-2xl p-4 bg-slate-800/60 border border-white/[0.07]">
                <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: color }}>
                  <Icono size={22} color="#0f172a" strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-[15px] font-black text-white">{titulo}</p>
                  <p className="text-[13px] text-slate-400 leading-snug mt-0.5">{texto}</p>
                </div>
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
        {sellosBienvenida > 0 && (
          <div className="mx-6 mb-6 rounded-3xl bg-[#8DC63F] p-5 flex items-center gap-4 animate-fade-in-up">
            <span className="w-14 h-14 rounded-full bg-white flex items-center justify-center shrink-0">
              <img src="/Logo2.png" alt="" className="w-9 h-9 object-contain" />
            </span>
            <p className="text-[17px] font-black text-[#1C3305] leading-tight text-left">
              {sellosBienvenida === 1 ? "Tu primer sello es de regalo" : `Te regalamos ${sellosBienvenida} sellos`}
              <span className="block text-[13px] font-bold text-[#2F4F0F] mt-1">al crear tu tarjeta</span>
            </p>
          </div>
        )}

        {/* ── CTA FINAL ── */}
        <section id="cta-final" className="px-6 pb-5 text-center">
          <h2 className="text-[26px] font-black tracking-tight text-white mb-5">
            Tu tarjeta está a un minuto
          </h2>
          <Link href={ctaHref} className="flex items-center justify-center gap-2 w-full h-14 bg-[#F0C84A] text-[#2A1B00] font-black text-[17px] rounded-[18px] shadow-[0_10px_28px_rgba(240,200,74,0.4)] no-underline">
            Crear mi tarjeta gratis <ArrowRight size={19} />
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
      <StickyCta href={ctaHref} watchIds={["cta-hero", "cta-final"]} />
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
          {...fotoOptimizada(local.imagenTarjeta || local.imagenPerfil, 48)}
          alt={local.businessName || local.name || "Local"}
          loading="lazy"
          decoding="async"
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
