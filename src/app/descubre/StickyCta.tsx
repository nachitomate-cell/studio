'use client';

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Smart Sticky CTA — botón flotante inferior que se oculta cuando la sección
 * final ("¿Listo para empezar?") entra en el viewport, para no chocar con el
 * CTA de cierre de página. Se observa el elemento con id={watchId}.
 */
export default function StickyCta({ href, watchId }: { href: string; watchId: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[100] px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-[linear-gradient(to_top,rgba(15,23,42,0.98)_70%,transparent)] backdrop-blur-[8px] transition-all duration-300 ${
        hidden ? "opacity-0 translate-y-10 pointer-events-none" : "opacity-100 translate-y-0"
      }`}
    >
      <Link
        href={href}
        className="flex items-center justify-center gap-2 w-full h-[50px] bg-gradient-to-br from-[#D3B673] to-[#BFA05C] text-slate-900 font-black text-[15px] rounded-2xl shadow-[0_8px_24px_rgba(211,182,115,0.38)] no-underline"
      >
        <Sparkles size={18} />
        Unirme al Club — Es gratis
      </Link>
    </div>
  );
}
