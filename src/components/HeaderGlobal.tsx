"use client";

/**
 * Cabecera con el logo, presente en toda la app.
 *
 * Se oculta en las pantallas que se proyectan o se ven a pantalla completa: en
 * un tótem LED la franja blanca del navegador rompe el diseño y encandila, que
 * es justo lo contrario de lo que se busca en un stand a oscuras.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Rutas que se muestran sin cabecera: las que se proyectan y las que se operan
 * a pantalla completa. En un tótem a oscuras la franja blanca encandila, y en
 * el mando la cabecera solo roba espacio al botón.
 */
const SIN_CABECERA = [
  "/expovino/pantalla",
  "/moderador/ruleta",
  "/moderador/boton",
];

export function HeaderGlobal() {
  const pathname = usePathname();
  if (SIN_CABECERA.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return null;

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-sm py-3 flex flex-col items-center justify-center w-full sticky top-0 z-50 pt-safe border-b border-slate-100">
      <Link
        href="/"
        className="flex flex-col items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
      >
        <img src="/Logo2.png" alt="Patio" className="h-10 object-contain" />
        <span style={{ fontSize: "10px", letterSpacing: "2px", color: "#666", fontWeight: 600, marginTop: "2px" }}>
          PATIO CURAUMA
        </span>
      </Link>
    </header>
  );
}
