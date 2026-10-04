/**
 * Splash de Club Patio mientras la app arranca.
 *
 * POR QUÉ EXISTE: la home era `<Suspense fallback={null}>`. Como usa
 * useSearchParams, Next no la pinta en el servidor y el HTML llegaba vacío:
 * pantalla blanca hasta que bajaba y corría todo el JavaScript (varios segundos
 * en 4G). Después venía otro overlay blanco esperando la publicidad.
 *
 * Este componente va en el HTML del servidor, así que se ve apenas llega la
 * página. Las animaciones son CSS puro a propósito: se mueven antes de que
 * cargue el JavaScript, que es justo cuando hacen falta.
 *
 * Sin "use client": no tiene estado, sirve igual en server y client components.
 */

import Image from "next/image";

export function PantallaCarga() {
  return (
    <div className="pc-raiz" role="status" aria-label="Cargando Club Patio">
      <div className="pc-franja" />
      <div className="pc-mancha pc-m1" />
      <div className="pc-mancha pc-m2" />
      <div className="pc-mancha pc-m3" />

      <div className="pc-centro">
        <div className="pc-logo">
          <span className="pc-onda" />
          <span className="pc-onda pc-onda2" />
          <Image
            src="/Logo3.webp"
            alt="Club Patio"
            width={112}
            height={142}
            priority
            className="pc-img"
          />
        </div>
        <p className="pc-marca">Club Patio</p>
        <p className="pc-sub">Patio Curauma</p>
        <div className="pc-puntos" aria-hidden>
          <span /><span /><span />
        </div>
      </div>

      <style>{`
        .pc-raiz {
          position: fixed; inset: 0; z-index: 9999; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: #FAFAF7;
        }
        .pc-franja {
          position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, #C9920A, #8DC63F, #5BB8D4);
        }
        .pc-mancha {
          position: absolute; border-radius: 9999px; filter: blur(60px);
          opacity: .16; pointer-events: none;
          animation: pc-deriva 10s ease-in-out infinite;
        }
        .pc-m1 { width: 280px; height: 280px; top: -90px; left: -110px; background: #C9920A; }
        .pc-m2 { width: 240px; height: 240px; top: 35%; right: -100px; background: #8DC63F; animation-duration: 12s; animation-delay: -3s; }
        .pc-m3 { width: 320px; height: 320px; bottom: -130px; left: -90px; background: #5BB8D4; animation-duration: 14s; animation-delay: -6s; }

        .pc-centro { position: relative; display: flex; flex-direction: column; align-items: center; animation: pc-entra .6s cubic-bezier(.2,.9,.3,1.2) both; }
        .pc-logo { position: relative; display: flex; align-items: center; justify-content: center; width: 168px; height: 168px; }
        .pc-img { position: relative; width: 112px; height: auto; animation: pc-flota 3.2s ease-in-out infinite; filter: drop-shadow(0 12px 18px rgba(0,0,0,.12)); }
        .pc-onda {
          position: absolute; inset: 0; border-radius: 9999px;
          border: 2px solid rgba(201,146,10,.45);
          animation: pc-onda 2.4s ease-out infinite;
        }
        .pc-onda2 { animation-delay: 1.2s; }

        .pc-marca {
          margin: 18px 0 0; font-family: var(--font-montserrat), Montserrat, sans-serif;
          font-size: 11px; font-weight: 800; letter-spacing: .3em; text-transform: uppercase;
          color: #C9920A;
        }
        .pc-sub {
          margin: 4px 0 0; font-family: var(--font-montserrat), Montserrat, sans-serif;
          font-size: 20px; font-weight: 800; color: #2C2C2C;
        }
        .pc-puntos { display: flex; gap: 8px; margin-top: 22px; }
        .pc-puntos span { width: 9px; height: 9px; border-radius: 9999px; animation: pc-salta 1.2s ease-in-out infinite; }
        .pc-puntos span:nth-child(1) { background: #C9920A; }
        .pc-puntos span:nth-child(2) { background: #8DC63F; animation-delay: .15s; }
        .pc-puntos span:nth-child(3) { background: #5BB8D4; animation-delay: .3s; }

        @keyframes pc-entra { from { opacity: 0; transform: scale(.85) translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes pc-flota { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes pc-onda { 0% { transform: scale(.7); opacity: .7; } 100% { transform: scale(1.35); opacity: 0; } }
        @keyframes pc-salta { 0%, 80%, 100% { transform: translateY(0) scale(.8); opacity: .5; } 40% { transform: translateY(-6px) scale(1); opacity: 1; } }
        @keyframes pc-deriva { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(28px, 22px); } }

        @media (prefers-reduced-motion: reduce) {
          .pc-raiz *, .pc-centro { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
