"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RewardsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDE_ITEMS = [
  {
    icon: "🌟",
    label: "Tus Sellos",
    desc: "Cada vez que compres en un local adherido, muestra tu Código QR en caja. El emprendedor lo escaneará y sumarás un sello en tu tarjeta digital.",
    color: "#C9920A",
  },
  {
    icon: "🎁",
    label: "Canjear Premios",
    desc: 'Desliza hacia abajo para ver el Catálogo. Cuando alcances los sellos necesarios, el botón se pondrá mostaza y dirá "¡Canjear ahora!". Muéstrale ese botón al locatario para recibir tu premio.',
    color: "#9DCC65",
  },
  {
    icon: "📲",
    label: "Tu Código QR",
    desc: "Es tu identificador único en el Patio. Solo debes mostrarlo al momento de pagar.",
    color: "#6EBBD1",
  },
  {
    icon: "💳",
    label: "Google Wallet",
    desc: "Toca este botón para guardar tu tarjeta de sellos directamente en tu teléfono. Así podrás ver tu progreso sin siquiera tener que abrir la app.",
    color: "#4285F4",
  },
  {
    icon: "🗺️",
    label: "Mi Ruta",
    desc: "¡Explora todo el patio! Descubre nuevos locales y colecciona sellos de diferentes emprendimientos.",
    color: "#2D6A4F",
  },
];

export function RewardsHelpModal({ isOpen, onClose }: RewardsHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col"
        style={{ maxHeight: "85dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + Header */}
        <div className="px-6 pt-5 pb-4 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-800">¿Cómo funciona?</h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Guía rápida · Mis Beneficios
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="px-6 overflow-y-auto flex-1 space-y-4 pb-2">
          {GUIDE_ITEMS.map(({ icon, label, desc, color }) => (
            <div key={label} className="flex gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-xl"
                style={{ backgroundColor: `${color}18` }}
              >
                {icon}
              </div>
              <div className="pt-1">
                <p className="text-sm font-bold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer fijo */}
        <div className="px-6 pt-4 pb-8 shrink-0 border-t border-slate-100 mt-2">
          <Button className="w-full h-12 rounded-2xl font-bold" onClick={onClose}>
            ¡Entendido!
          </Button>
        </div>
      </div>
    </div>
  );
}
