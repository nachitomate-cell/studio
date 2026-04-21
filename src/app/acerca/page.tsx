"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, MapPin, Star } from "lucide-react";

export default function AcercaPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-slate-100"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4" style={{ color: "#D3B673" }} />
          <h1 className="font-black text-slate-800 text-base">Acerca de la App</h1>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        {/* Logo / marca */}
        <div className="text-center space-y-4">
          <div
            className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #D3B673, #9DCC65)" }}
          >
            <img
              src="/Logo3.png"
              alt="Club Patio Curauma"
              className="w-14 h-14 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">Club Patio Curauma</h2>
            <span
              className="inline-block mt-1 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-400"
            >
              v1.0.0
            </span>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            La app de fidelización del centro comercial Patio Curauma. Acumula sellos,
            canjea premios y participa en sorteos exclusivos.
          </p>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Características */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            ¿Qué puedes hacer?
          </p>
          {[
            { emoji: "🎟️", text: "Acumular sellos digitales en cada compra" },
            { emoji: "🎁", text: "Canjear sellos por premios y beneficios exclusivos" },
            { emoji: "🏆", text: "Participar en el Gran Sorteo del Mes" },
            { emoji: "🔔", text: "Recibir notificaciones de ofertas y novedades" },
          ].map(({ emoji, text }) => (
            <div key={text} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
              <span className="text-xl">{emoji}</span>
              <p className="text-sm font-medium text-slate-700">{text}</p>
            </div>
          ))}
        </div>

        <div className="h-px bg-slate-100" />

        {/* Ubicación */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Dónde encontrarnos
          </p>
          <a
            href="https://maps.google.com/?q=Patio+Curauma+Valparaiso"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors"
          >
            <MapPin className="w-5 h-5 shrink-0" style={{ color: "#D3B673" }} />
            <div>
              <p className="text-sm font-bold text-slate-700">Patio Curauma</p>
              <p className="text-xs text-slate-400">Valparaíso, Chile</p>
            </div>
          </a>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Contacto */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Contacto y soporte
          </p>
          <a
            href="https://wa.me/56983568212"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl font-bold text-white transition-all active:scale-[0.98] shadow-lg"
            style={{ backgroundColor: "#9DCC65", boxShadow: "0 4px 20px #9DCC6540" }}
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            Contacto para soporte o desarrollo
          </a>
        </div>

        <div className="pt-6 pb-8 border-t border-slate-100 text-center space-y-2">
          <p className="text-xs font-medium text-slate-500">© {new Date().getFullYear()} Club Patio Curauma</p>
          <p className="text-[11px] text-slate-300">
            Hecho con ☕ en Valparaíso ·{" "}
            <span style={{ color: "#D3B673" }}>@mateluna</span>
          </p>
        </div>

        <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "32px", paddingTop: "24px", textAlign: "center", paddingBottom: "32px" }}>
          <p style={{ fontSize: "13px", color: "#999999", marginBottom: "16px", fontFamily: "Montserrat, sans-serif" }}>
            Hecho con ☕ en Valparaíso · @mateluna
          </p>
          <img
            src="/logoempresa.png"
            alt="SinapTech Spa"
            style={{ width: "120px", height: "auto", objectFit: "contain", display: "block", margin: "0 auto 8px" }}
          />
          <p style={{ fontSize: "12px", color: "#BBBBBB", fontFamily: "Montserrat, sans-serif" }}>
            Desarrollado por SinapTech Spa
          </p>
        </div>
      </div>
    </div>
  );
}
