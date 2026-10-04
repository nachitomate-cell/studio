'use client';

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Smart Sticky CTA — botón flotante inferior que se oculta mientras se ve
 * cualquiera de los otros botones de la página (el de la portada y el de
 * cierre), para no mostrar dos "Crear mi tarjeta" juntos.
 * Se observan los elementos con los ids de `watchIds`.
 */
export default function StickyCta({ href, watchIds }: { href: string; watchIds: string[] }) {
  const [hidden, setHidden] = useState(true);
  const clave = watchIds.join(",");

  useEffect(() => {
    const targets = clave.split(",").map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (targets.length === 0) { setHidden(false); return; }

    const visibles = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visibles.add(e.target);
          else visibles.delete(e.target);
        }
        setHidden(visibles.size > 0);
      },
      { threshold: 0.1 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [clave]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[100] px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-[linear-gradient(to_top,rgba(15,23,42,0.98)_70%,transparent)] backdrop-blur-[8px] transition-all duration-300 ${
        hidden ? "opacity-0 translate-y-10 pointer-events-none" : "opacity-100 translate-y-0"
      }`}
    >
      <Link
        href={href}
        className="flex items-center justify-center w-full h-[52px] bg-[#F0C84A] text-[#2A1B00] font-black text-base rounded-2xl shadow-[0_8px_24px_rgba(240,200,74,0.38)] no-underline"
      >
        Crear mi tarjeta gratis
      </Link>
    </div>
  );
}
