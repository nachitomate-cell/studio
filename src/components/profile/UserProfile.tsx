
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, User, signOut, deleteUser } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection, query, orderBy, limit, deleteDoc, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Gift, Award, LogOut,
  User as UserIcon, Phone,
  QrCode, Edit2, Check, X, Trophy, Save, Store,
  Smile, Cat, Dog, Coffee, Star,
  MessageCircle, MapPin,
  Clock, Bell, CheckCircle2,
  ExternalLink, Sparkles,
  Calendar, FlaskConical, Navigation,
  LayoutDashboard, AlertTriangle, Trash2,
  Loader2, Info, MessageSquare, ChevronRight,
  Copy, Share2, Users,
  Sun, TreePine, Backpack, Bird, Leaf, Music, Heart, ShoppingBag, Pencil, Flower2, Flame,
} from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { registrarCompra } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { CatalogoPremios } from "./CatalogoPremios";
import { ActivityFeed } from "./ActivityFeed";
import { FavoriteShops } from "./FavoriteShops";
import PermissionsModal from "@/components/PermissionsModal";
import { cn } from "@/lib/utils";
import { PATIO_INFO } from "@/lib/data";
import Link from "next/link";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { registerFcmToken } from "@/lib/fcmTokenManager";
import { verificarYGenerarRecordatorioIA, procesarProximidadGeofence } from "@/lib/ai-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { hasRole } from "@/lib/roles";
import { type AIInsight } from "@/components/SynapTechAI";
import { AIAssistantModal } from "@/components/ai/AIAssistantModal";

function generarInsightosSocio(data: any): AIInsight[] {
  if (!data) return [];
  const out: AIInsight[] = [];
  const sellos: number = data.comprasRealizadas || 0;
  const historicos: number = data.sellosHistoricos ?? sellos;
  const racha: number = data.rachaActual || 0;
  const sellosLocales: Record<string, number> = data.sellosLocales || {};

  // Progreso a próxima tarjeta
  const restantesTarjeta = sellos === 0 ? 10 : (10 - (sellos % 10)) || 10;
  if (sellos === 0) {
    out.push({ icon: "⭐", type: "neutral", text: "Aún no tienes sellos. Visita cualquier local aliado y escanea su QR para empezar a acumular." });
  } else if (restantesTarjeta <= 2) {
    out.push({ icon: "🎁", type: "positive", text: `¡Estás muy cerca! Te faltan solo ${restantesTarjeta} sello${restantesTarjeta !== 1 ? "s" : ""} para completar tu próxima tarjeta y canjear un premio.` });
  } else {
    out.push({ icon: "⭐", type: "neutral", text: `Llevas ${sellos} sello${sellos !== 1 ? "s" : ""} activos. Te faltan ${restantesTarjeta} para completar tu próxima tarjeta y acceder a un premio.` });
  }

  // Racha de visitas
  if (racha >= 7) {
    out.push({ icon: "🔥", type: "positive", text: `Racha de ${racha} días consecutivos. ¡Impresionante constancia! Mantenerla es la forma más rápida de acumular sellos y subir de rango.` });
  } else if (racha >= 3) {
    out.push({ icon: "🔥", type: "positive", text: `Llevas ${racha} días seguidos visitando el Patio. Visita mañana para mantener la racha activa.` });
  } else if (racha === 0 || racha === 1) {
    out.push({ icon: "📅", type: "neutral", text: "Visita el Patio al menos un día seguido para comenzar tu racha. Las rachas largas aceleran tu progreso de rango." });
  }

  // Local favorito
  const localEntries = Object.entries(sellosLocales);
  if (localEntries.length > 0) {
    const [favId, favCount] = localEntries.sort((a, b) => b[1] - a[1])[0];
    if (favCount >= 3) {
      out.push({ icon: "🏪", type: "neutral", text: `Tienes ${favCount} visitas en tu local más frecuentado. La fidelidad con un local te da acceso prioritario a sus premios exclusivos.` });
    }
  }

  // Rango y progreso
  if (historicos >= 50) {
    out.push({ icon: "🏆", type: "positive", text: `Con ${historicos} sellos históricos estás en el rango más alto de socios activos. Tu historial refleja un compromiso excepcional con el Club.` });
  } else if (historicos >= 15) {
    const faltanOro = 50 - historicos;
    out.push({ icon: "🏆", type: "neutral", text: `Estás en Plata. Te faltan ${faltanOro} sellos históricos para alcanzar el rango Oro y desbloquear beneficios exclusivos.` });
  } else if (historicos >= 5) {
    const faltanPlata = 15 - historicos;
    out.push({ icon: "🥉", type: "neutral", text: `Rango Bronce activo. Con ${faltanPlata} sellos históricos más llegarás al rango Plata.` });
  }

  // Perfil incompleto
  if (!data.perfilCompletoBonus && !(data.telefono?.trim() && data.fechaNacimiento?.trim())) {
    out.push({ icon: "💡", type: "warning", text: "Completa tu perfil (teléfono + fecha de nacimiento) para recibir 1 sello extra de bono. Toca el botón de editar." });
  }

  return out;
}

function calcularRango(sellos: number): { nombre: string; color: string; emoji: string; siguiente: number | null; progreso: number } {
  if (sellos >= 100) return { nombre: "Platino", color: "#A8D5E2", emoji: "💎", siguiente: null, progreso: 100 };
  if (sellos >= 50)  return { nombre: "Oro",     color: "#D3B673", emoji: "🏆", siguiente: 100, progreso: Math.round(((sellos - 50) / 50) * 100) };
  if (sellos >= 15)  return { nombre: "Plata",   color: "#94A3B8", emoji: "⭐", siguiente: 50,  progreso: Math.round(((sellos - 15) / 35) * 100) };
  if (sellos >= 5)   return { nombre: "Bronce",  color: "#C9920A", emoji: "🥉", siguiente: 15,  progreso: Math.round(((sellos - 5) / 10) * 100) };
  return { nombre: "Visitante", color: "#9DCC65", emoji: "🌱", siguiente: 5, progreso: Math.round((sellos / 5) * 100) };
}

// ── Stats Info Modal ─────────────────────────────────────────────────────────
const RANGOS = [
  { nombre: "Visitante", emoji: "🌱", color: "#9DCC65", bg: "#F0FDF4", min: 0,   max: 4   },
  { nombre: "Bronce",    emoji: "🥉", color: "#C9920A", bg: "#FEF9EC", min: 5,   max: 14  },
  { nombre: "Plata",     emoji: "⭐", color: "#94A3B8", bg: "#F8FAFC", min: 15,  max: 49  },
  { nombre: "Oro",       emoji: "🏆", color: "#D3B673", bg: "#FEFCE8", min: 50,  max: 99  },
  { nombre: "Platino",   emoji: "💎", color: "#A8D5E2", bg: "#F0F9FF", min: 100, max: null },
];

function StatsInfoModal({
  sellos,
  sellosHistoricos,
  racha,
  rachaMaxima,
  rango,
  onClose,
}: {
  sellos: number;
  sellosHistoricos: number;
  racha: number;
  rachaMaxima: number;
  rango: ReturnType<typeof calcularRango>;
  onClose: () => void;
}) {
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

        {/* Header */}
        <div className="px-7 pt-5 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-800">Tus Estadísticas</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Cómo funcionan sellos, racha y rango</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-px bg-slate-100 mx-7 shrink-0" />

        <div className="overflow-y-auto px-7 py-5 space-y-5 flex-1">

          {/* ── Sellos ── */}
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-primary/5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl">🎟️</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-800">Sellos</p>
                <p className="text-[11px] text-slate-400 font-medium">Tu tarjeta de fidelidad</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-primary leading-none">{sellos}</p>
                <p className="text-[10px] text-slate-400 font-bold">total</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-500 leading-relaxed">
                Cada visita a un local aliado y escaneo de QR te otorga <span className="font-bold text-slate-700">1 sello</span>.
                Junta <span className="font-bold text-slate-700">10 sellos</span> para completar una tarjeta y canjear un premio.
              </p>
              {/* Mini tarjeta visual */}
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black"
                    style={{
                      background: i < sellosEnTarjeta ? "var(--primary)" : "#F1F5F9",
                      color: i < sellosEnTarjeta ? "#fff" : "#CBD5E1",
                    }}
                  >
                    {i < sellosEnTarjeta ? "★" : "○"}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 text-center">
                <div className="flex-1 bg-slate-50 rounded-xl py-2 px-3">
                  <p className="text-base font-black text-slate-700">{sellosEnTarjeta}<span className="text-xs font-bold text-slate-400">/10</span></p>
                  <p className="text-[10px] text-slate-400 font-bold">En tarjeta actual</p>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl py-2 px-3">
                  <p className="text-base font-black text-slate-700">{sellosHistoricos}</p>
                  <p className="text-[10px] text-slate-400 font-bold">Histórico total</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Racha ── */}
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: racha >= 3 ? "#FFF7ED" : "#F8FAFC" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: racha >= 3 ? "#FED7AA" : "#F1F5F9" }}>
                <span className="text-xl">{racha >= 3 ? "🔥" : "📅"}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-800">Racha</p>
                <p className="text-[11px] text-slate-400 font-medium">Días consecutivos en la app</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black leading-none" style={{ color: racha >= 3 ? "#f97316" : "#94a3b8" }}>
                  {racha}{racha >= 3 ? "🔥" : ""}
                </p>
                <p className="text-[10px] text-slate-400 font-bold">días</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-500 leading-relaxed">
                Abre la app cada día para mantener tu racha. Si saltas un día,
                vuelve a <span className="font-bold text-slate-700">1</span>.
                Con <span className="font-bold text-orange-500">3 días seguidos</span> se activa el 🔥.
              </p>
              <div className="flex gap-3 text-center">
                <div className="flex-1 rounded-xl py-2 px-3" style={{ background: "#FFF7ED" }}>
                  <p className="text-base font-black leading-none" style={{ color: "#f97316" }}>{racha}🔥</p>
                  <p className="text-[10px] font-bold mt-0.5" style={{ color: "#fdba74" }}>Racha actual</p>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl py-2 px-3">
                  <p className="text-base font-black text-slate-700 leading-none">{rachaMaxima}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Mejor racha</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Rango ── */}
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: RANGOS.find(r => r.nombre === rango.nombre)?.bg ?? "#F8FAFC" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${rango.color}22` }}>
                <span className="text-xl">{rango.emoji}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-800">Rango</p>
                <p className="text-[11px] font-bold" style={{ color: rango.color }}>{rango.nombre}</p>
              </div>
              {rango.siguiente !== null && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold">{sellosHistoricos} / {rango.siguiente}</p>
                  <p className="text-[10px] text-slate-400">para el siguiente</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                El rango sube automáticamente según tus <span className="font-bold text-slate-700">sellos históricos</span> acumulados,
                nunca baja aunque canjees premios.
              </p>

              {/* Progress bar */}
              {rango.siguiente !== null && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>{rango.nombre}</span>
                    <span>{RANGOS.find(r => r.min === rango.siguiente)?.nombre ?? ""}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${rango.progreso}%`, backgroundColor: rango.color }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-right">{rango.progreso}% completado</p>
                </div>
              )}

              {/* Rangos list */}
              <div className="space-y-2">
                {RANGOS.map((r) => {
                  const isCurrent = r.nombre === rango.nombre;
                  return (
                    <div
                      key={r.nombre}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
                      style={{ background: isCurrent ? `${r.color}18` : "#F8FAFC", border: isCurrent ? `1.5px solid ${r.color}55` : "1.5px solid transparent" }}
                    >
                      <span className="text-base w-6 text-center">{r.emoji}</span>
                      <div className="flex-1">
                        <p className="text-xs font-black" style={{ color: isCurrent ? r.color : "#475569" }}>{r.nombre}</p>
                        <p className="text-[10px] text-slate-400">
                          {r.max !== null ? `${r.min} – ${r.max} sellos` : `${r.min}+ sellos`}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: r.color }}>
                          Actual
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: "#D3B673" }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

const AVATAR_OPTIONS = [
  { id: 'User',        icon: UserIcon,     color: 'bg-slate-100 text-slate-600' },
  { id: 'Smile',       icon: Smile,        color: 'bg-yellow-100 text-yellow-600' },
  { id: 'Heart',       icon: Heart,        color: 'bg-red-100 text-red-500' },
  { id: 'Star',        icon: Star,         color: 'bg-purple-100 text-purple-600' },
  { id: 'Sun',         icon: Sun,          color: 'bg-amber-100 text-amber-500' },
  { id: 'Flame',       icon: Flame,        color: 'bg-orange-100 text-orange-500' },
  { id: 'Leaf',        icon: Leaf,         color: 'bg-green-100 text-green-600' },
  { id: 'TreePine',    icon: TreePine,     color: 'bg-emerald-100 text-emerald-700' },
  { id: 'Flower2',     icon: Flower2,      color: 'bg-pink-100 text-pink-500' },
  { id: 'Bird',        icon: Bird,         color: 'bg-sky-100 text-sky-600' },
  { id: 'Cat',         icon: Cat,          color: 'bg-orange-100 text-orange-600' },
  { id: 'Dog',         icon: Dog,          color: 'bg-blue-100 text-blue-600' },
  { id: 'Coffee',      icon: Coffee,       color: 'bg-amber-100 text-amber-800' },
  { id: 'Music',       icon: Music,        color: 'bg-violet-100 text-violet-600' },
  { id: 'ShoppingBag', icon: ShoppingBag,  color: 'bg-teal-100 text-teal-600' },
  { id: 'Backpack',    icon: Backpack,     color: 'bg-indigo-100 text-indigo-600' },
];

function NotifDetailModal({ notif, onClose }: { notif: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla superior */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2" />

        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", notif.isAI ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
            {notif.isAI ? <Sparkles className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Título y fecha */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 leading-snug">{notif.titulo}</h2>
          <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-widest">
            {new Date(notif.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Cuerpo */}
        <p className="text-base text-slate-600 leading-relaxed">{notif.mensaje}</p>

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function AcercaDeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla superior */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2" />

        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <Info className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Título y versión */}
        <div className="space-y-2">
          <h2 className="text-xl font-black leading-snug" style={{ color: "#4A4A4A" }}>
            Acerca de la App
          </h2>
          <span className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-400">
            v1.0.0
          </span>
        </div>

        {/* Separador */}
        <div className="h-px bg-slate-100 rounded-full" />

        {/* Botón de contacto */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Contacto</p>
          <a
            href="https://wa.me/56983568212"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg"
            style={{ backgroundColor: "#9DCC65", boxShadow: "0 4px 20px #9DCC6540" }}
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            Contacto para soporte o desarrollo
          </a>
        </div>

        {/* Firma */}
        <p className="text-center text-[11px] text-slate-300 font-light tracking-wide pt-2">
          Hecho con ☕ en Valparaíso · 2026
        </p>
      </div>
    </div>
  );
}

function TerminosModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{ maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla superior */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

        {/* Cabecera fija */}
        <div className="px-8 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(211,182,115,0.15)", color: "#D3B673" }}>
              <Info className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 space-y-1">
            <h2 className="text-xl font-black leading-snug" style={{ color: "#4A4A4A" }}>
              Términos y Condiciones
            </h2>
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-400">
              Club Patio Curauma
            </span>
          </div>
        </div>

        {/* Separador */}
        <div className="h-px bg-slate-100 mx-8 shrink-0" />

        {/* Scroll */}
        <div className="overflow-y-auto px-8 py-5 space-y-5 flex-1">
          <TermSection title="1. Aceptación de los Términos">
            Al registrarse y utilizar la aplicación Club Patio Curauma (en adelante, <strong>"la App"</strong>), el usuario acepta estos Términos y Condiciones. Si no está de acuerdo, debe abstenerse de utilizar el servicio.
          </TermSection>
          <TermSection title="2. Descripción del Servicio">
            Club Patio Curauma es una plataforma de fidelización digital para digitalizar la experiencia de compra en Patio Curauma. La App permite:
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li>Acumular sellos digitales por compras en locales adheridos.</li>
              <li>Recibir sellos de bienvenida o bonos por inicio de sesión.</li>
              <li>Canjear sellos por recompensas y beneficios exclusivos.</li>
            </ul>
          </TermSection>
          <TermSection title="3. Registro y Privacidad">
            El usuario se compromete a proporcionar información real y precisa (Nombre, Email, Teléfono, Fecha de Nacimiento).
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Datos Personales:</strong> Usados para gestión de puntos, personalización y, si es aceptado, comunicaciones de marketing.</li>
              <li><strong>Seguridad:</strong> El usuario es responsable de mantener la confidencialidad de su cuenta.</li>
            </ul>
          </TermSection>
          <TermSection title="4. Sistema de Sellos y Recompensas">
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Sello de Bienvenida:</strong> Un (1) sello automático al registrarse, por única vez.</li>
              <li><strong>Bono de Inicio de Sesión:</strong> Un (1) sello extra por inicio de sesión, de única vez por usuario.</li>
              <li><strong>Acumulación:</strong> Sellos por compra otorgados exclusivamente por locatarios autorizados.</li>
              <li><strong>Valor:</strong> Los sellos no tienen valor monetario ni son transferibles.</li>
            </ul>
          </TermSection>
          <TermSection title="5. Canje y Vigencia">
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Ticket de Canje:</strong> Se genera al completar los sellos requeridos.</li>
              <li><strong>Vigencia:</strong> Cada ticket tiene validez máxima de <strong>48 horas</strong>. Expirado el plazo, el beneficio se pierde.</li>
              <li><strong>Validación:</strong> El beneficio se confirma cuando el locatario valida el ticket en el sistema.</li>
            </ul>
          </TermSection>
          <TermSection title="6. Uso Justo y Anti-Fraude">
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Cooldown:</strong> Máximo un sello por usuario cada <strong>12 horas</strong>.</li>
              <li><strong>Auditoría:</strong> La administración puede auditar registros. Actividad sospechosa resultará en suspensión de cuenta.</li>
            </ul>
          </TermSection>
          <TermSection title="7. Comunicaciones de Marketing">
            Al marcar la casilla correspondiente, el usuario acepta recibir ofertas y promociones vía email o WhatsApp.
          </TermSection>
          <TermSection title="8. Limitación de Responsabilidad">
            Club Patio Curauma actúa como intermediario tecnológico. La disponibilidad de premios es responsabilidad de cada local comercial.
          </TermSection>
          <TermSection title="9. Modificaciones">
            La administración se reserva el derecho de modificar estos términos informando a los usuarios a través de la App.
          </TermSection>
        </div>

        {/* Botón cerrar fijo */}
        <div className="px-8 py-5 shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98] shadow-lg"
            style={{ backgroundColor: "#D3B673", boxShadow: "0 4px 20px rgba(211,182,115,0.4)" }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function TermSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "#D3B673" }}>{title}</p>
      <div className="text-[13px] text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

function SwipeableNotification({ notif, onDelete, onOpen }: { notif: any; onDelete: (id: string) => void; onOpen: (notif: any) => void }) {
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: any) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: any) => {
    const diff = e.touches[0].clientX - startX;
    if (diff < 0) {
      setIsSwiping(true);
      setOffsetX(Math.max(diff, -100));
    }
  };

  const handleTouchEnd = () => {
    if (offsetX < -60) {
      setOffsetX(-150);
      setTimeout(() => onDelete(notif.id), 200);
    } else {
      setOffsetX(0);
    }
  };

  const handleClick = () => {
    if (!isSwiping) onOpen(notif);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
       <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl">
          <Trash2 className="text-white w-6 h-6 animate-pulse" />
       </div>

       <div
          className="relative transition-transform duration-200 cursor-pointer"
          style={{ transform: `translateX(${offsetX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
       >
          <Card className={cn(
            "border-none shadow-sm rounded-2xl overflow-hidden transition-all",
            notif.isAI ? "bg-gradient-to-br from-white to-primary/5 border-l-4 border-l-primary" : "bg-white",
            notif.actionUrl ? "hover:bg-amber-50/60 active:bg-amber-100/60 border-l-4 border-l-amber-400" : ""
          )}>
            <CardContent className="p-4 flex gap-4 items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                notif.isAI ? "bg-primary text-white" :
                notif.actionUrl ? "bg-amber-100 text-amber-600" :
                "bg-slate-100 text-slate-400"
              )}>
                {notif.isAI ? <Sparkles className="w-5 h-5" /> :
                 notif.actionUrl ? <span className="text-lg leading-none">🛒</span> :
                 <Bell className="w-5 h-5" />}
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-800 truncate">{notif.titulo}</h4>
                  <span className="text-[8px] text-slate-400 uppercase font-bold shrink-0">{new Date(notif.fecha).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{notif.mensaje}</p>
                {notif.actionUrl && (
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">
                    Toca para abrir el panel →
                  </p>
                )}
              </div>
              {notif.actionUrl && (
                <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
              )}
            </CardContent>
          </Card>
       </div>
    </div>
  );
}

const getInitials = (name: string | undefined) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((word: string) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

function ReferralInfoModal({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      icon: <Share2 className="w-5 h-5" />,
      color: "#D3B673",
      bg: "rgba(211,182,115,0.12)",
      title: "Comparte tu código",
      desc: "Copia tu código único o usa el botón de compartir para enviárselo a tus amigos.",
    },
    {
      icon: <Users className="w-5 h-5" />,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.1)",
      title: "Tu amigo se registra",
      desc: "Se inscribe en Club Patio ingresando tu código al crear su cuenta. Él recibe +1 sello extra de bienvenida.",
    },
    {
      icon: <Store className="w-5 h-5" />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
      title: "Primera visita real",
      desc: "Tu bono se activa cuando tu amigo realice su primera compra real en un local del Club (no al momento del registro).",
    },
    {
      icon: <Gift className="w-5 h-5" />,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
      title: "Tú ganas +1 sello",
      desc: "Recibirás una notificación y +1 sello en tu tarjeta en cuanto tu amigo haga su primera visita.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

        <div className="px-7 pt-5 pb-4 shrink-0 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, #D3B673, #C9920A)" }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-tight">Programa de Referidos</h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">¿Cómo funciona?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0 mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-7 pb-7 overflow-y-auto space-y-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-2xl p-4"
              style={{ backgroundColor: s.bg, border: `1px solid ${s.color}22` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundColor: s.color, color: "white" }}
              >
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: s.color + "22", color: s.color }}
                  >
                    Paso {i + 1}
                  </span>
                </div>
                <p className="text-sm font-black text-slate-800">{s.title}</p>
                <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}

          {/* Aviso límite mensual */}
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700">Límite mensual:</span> puedes ganar hasta{" "}
              <span className="font-bold text-red-500">3 bonos de referido por mes</span> calendario.
              El límite se reinicia automáticamente cada mes.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-bold text-sm text-white transition-all mt-1"
            style={{ background: "linear-gradient(135deg, #D3B673, #C9920A)" }}
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}

interface UserProfileProps {
  onSwitchMode: () => void;
  onShowAuth: () => void;
}

export function UserProfile({ onShowAuth }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userData, setUserData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);
  const [showStatsInfo, setShowStatsInfo] = useState(false);
  const [showPermisos, setShowPermisos] = useState(false);
  const [showReferralInfo, setShowReferralInfo] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [sugerenciaTexto, setSugerenciaTexto] = useState("");
  const [sugerenciaCategoria, setSugerenciaCategoria] = useState<"mejora" | "problema" | "otro">("mejora");
  const [sugerenciaLoading, setSugerenciaLoading] = useState(false);
  const [sugerenciaEnviada, setSugerenciaEnviada] = useState(false);
  // Banner de instalación PWA para iOS: visible cuando el usuario está en Safari/iOS
  // pero NO instaló la app en su pantalla de inicio (modo standalone).
  const [showIosHint, setShowIosHint] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState("User");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [showProfileAI, setShowProfileAI] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "¡Buenos días!";
    if (hour < 19) return "¡Buenas tardes!";
    return "¡Buenas noches!";
  }, []);

  const [editForm, setEditForm] = useState({
    nombre: "",
    telefono: "",
    avatarId: "User",
    fechaNacimiento: "",
    nombreTienda: "",
    rubro: "",
    descripcion: "",
    whatsapp: "",
    instagram: "",
    ubicacionTienda: "",
    promoOptIn: false
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        const perm = Notification.permission;
        setPushEnabled(perm === "granted");
        setNotifDenied(perm === "denied");
        // Refrescar token FCM silenciosamente si el permiso ya fue otorgado.
        // Previene que tokens rotados por el SDK queden desactualizados en Firestore.
        if (perm === "granted") {
          registerFcmToken().catch(() => {});
        }
      }
      setNotifBannerDismissed(localStorage.getItem("notif_banner_dismissed") === "true");
      // Detectar iOS fuera de modo standalone (no instalada como PWA).
      // Las notificaciones push en iOS SOLO funcionan en modo standalone.
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      if (isIos && !isStandalone) {
        setShowIosHint(true);
      }
    }
    return () => unsubscribeAuth();
  }, []);

  // Re-check notification permission when user returns from device settings
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible" && "Notification" in window) {
        const perm = Notification.permission;
        setPushEnabled(perm === "granted");
        setNotifDenied(perm === "denied");
      }
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, []);

  useEffect(() => {
    // Guard: si no hay usuario autenticado, limpiamos el estado y salimos
    if (!user) {
      setUserData(null);
      setNotificaciones([]);
      return;
    }

    let unsubscribeDoc: (() => void) | undefined;
    let unsubscribeNotif: (() => void) | undefined;

    const userRef = doc(db, "usuarios", user.uid);
    unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setEditForm({
          nombre: data.nombre || "",
          telefono: data.telefono || "",
          avatarId: data.avatarId || "User",
          fechaNacimiento: data.fechaNacimiento || "",
          nombreTienda: data.nombreTienda || "",
          rubro: data.rubro || "",
          descripcion: data.descripcion || "",
          whatsapp: data.whatsapp || "",
          instagram: data.instagram || "",
          ubicacionTienda: data.ubicacionTienda || "",
          promoOptIn: data.promoOptIn || false
        });

        verificarYGenerarRecordatorioIA(user.uid, data.nombre, data.comprasRealizadas || 0);
      }
    });

    const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
    const qNotif = query(notifRef, orderBy("fecha", "desc"), limit(5));
    unsubscribeNotif = onSnapshot(
      qNotif,
      (snapshot) => {
        setNotificaciones(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        
        // Lanzar Notificación Push OS para alertas recién llegadas
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
             const data = change.doc.data();
             const ageEnMs = new Date().getTime() - new Date(data.fecha).getTime();
             // Evitamos spam de notificaciones antiguas al cargar la bbdd.
             // Solo si la notificación tiene menos de 10 segundos.
             if (ageEnMs < 10000 && !data.leida) {
                dispararAlertaSistema(data.titulo, data.mensaje);
             }
          }
        });
      },
      // onError: si Firestore devuelve permiso denegado (usuario ya cerró sesión)
      // simplemente ignoramos el error sin que rompa la app
      (error) => {
        if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
          console.warn("[Notificaciones] Listener detenido: sesión cerrada.");
        } else {
          console.error("[Notificaciones] Error inesperado:", error);
        }
      }
    );

    return () => {
      unsubscribeDoc?.();
      unsubscribeNotif?.();
    };
  }, [user]);

  // ── Racha de visitas ─────────────────────────────────────────────────────────
  const streakUpdatedRef = useRef(false);
  useEffect(() => {
    if (!user || !userData || streakUpdatedRef.current) return;
    const hoy = new Date().toISOString().slice(0, 10);
    if (userData.ultimaVisita === hoy) { streakUpdatedRef.current = true; return; }
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const rachaActual = userData.rachaActual || 0;
    const nuevaRacha = userData.ultimaVisita === ayer ? rachaActual + 1 : 1;
    const sellosHist = userData.sellosHistoricos ?? userData.comprasRealizadas ?? 0;
    const rangoActual = calcularRango(sellosHist).nombre;
    streakUpdatedRef.current = true;
    updateDoc(doc(db, "usuarios", user.uid), {
      rachaActual: nuevaRacha,
      ultimaVisita: hoy,
      rachaMaxima: Math.max(userData.rachaMaxima || 0, nuevaRacha),
      rangoActual,
      rangoMaximo: userData.rangoMaximo && calcularRango(sellosHist).siguiente !== null
        ? userData.rangoMaximo
        : rangoActual,
    }).catch(() => {});
  }, [user, userData]);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast({ title: "No compatible", description: "Tu navegador no soporta notificaciones." });
      return;
    }

    const result = await registerFcmToken();

    if (result.ok) {
      setPushEnabled(true);
      setNotifDenied(false);
      setNotifBannerDismissed(false);
      localStorage.removeItem("notif_banner_dismissed");
      toast({ title: "¡Notificaciones activadas!", description: "Recibirás avisos de sellos y premios." });
      dispararAlertaSistema("¡Club Patio activado!", "Gracias por habilitar las alertas.");
      return;
    }

    switch (result.reason) {
      case "unsupported":
        toast({ title: "No disponible", description: "Instala la app en tu pantalla de inicio y vuelve a intentarlo." });
        break;
      case "denied":
        setNotifDenied(true);
        toast({ variant: "destructive", title: "Permiso bloqueado", description: "Actívalo desde los Ajustes del sistema." });
        break;
      case "no_vapid_key":
        toast({ variant: "destructive", title: "Error de configuración", description: "Falta clave del servidor. Contacta al administrador." });
        console.error("[FCM] Agrega NEXT_PUBLIC_FIREBASE_VAPID_KEY en Vercel → Settings → Environment Variables.");
        break;
      case "sw_error":
        toast({ variant: "destructive", title: "Error al registrar notificaciones", description: "Recarga la app e intenta de nuevo." });
        break;
      case "token_error":
        toast({ variant: "destructive", title: "No se pudo activar", description: "Verifica tu conexión e intenta de nuevo." });
        break;
      case "no_user":
        toast({ variant: "destructive", title: "Sesión expirada", description: "Vuelve a iniciar sesión e intenta de nuevo." });
        break;
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", user.uid);
      const updateData: any = {
        nombre: editForm.nombre,
        telefono: editForm.telefono,
        avatarId: editForm.avatarId,
        fechaNacimiento: editForm.fechaNacimiento,
        promoOptIn: editForm.promoOptIn,
        updatedAt: new Date().toISOString()
      };

      if (hasRole(userData, "emprendedor")) {
        updateData.nombreTienda = editForm.nombreTienda;
        updateData.rubro = editForm.rubro;
        updateData.descripcion = editForm.descripcion;
        updateData.whatsapp = editForm.whatsapp;
        updateData.instagram = editForm.instagram;
        updateData.ubicacionTienda = editForm.ubicacionTienda;
      }

      const wasComplete = Boolean(userData?.telefono?.trim()) && Boolean(userData?.fechaNacimiento?.trim());
      const willBeComplete = Boolean(editForm.telefono?.trim()) && Boolean(editForm.fechaNacimiento?.trim());
      const giveBonus = !wasComplete && willBeComplete && !userData?.perfilCompletoBonus && !hasRole(userData, "emprendedor");

      if (giveBonus) {
        const currentSellos = userData?.comprasRealizadas || 0;
        updateData.comprasRealizadas = increment(1);
        updateData.sellosHistoricos = increment(1);
        updateData.recompensaDisponible = (currentSellos + 1) >= 5;
        updateData.perfilCompletoBonus = true;
      }

      await updateDoc(userRef, updateData);
      setIsEditing(false);

      if (giveBonus) {
        toast({ title: "¡Perfil completo! +1 sello extra", description: "Gracias por completar tu información. ¡El sello ya está en tu cuenta!" });
        addDoc(collection(db, "system_logs"), {
          usuario: editForm.nombre || "Miembro del Club",
          usuarioId: user.uid,
          accion: "recibió sello por perfil completo",
          fecha: new Date().toISOString(),
          tipo: "FIDELIZACION",
          metodo: "PERFIL_COMPLETO",
        }).catch(() => {});
      } else {
        toast({ title: "Perfil actualizado", description: "Tus datos se han guardado correctamente." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudieron actualizar los datos." });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAvatar = async () => {
    if (!user) return;
    setSavingAvatar(true);
    try {
      await updateDoc(doc(db, "usuarios", user.uid), { avatarId: pendingAvatarId });
      setEditForm(prev => ({ ...prev, avatarId: pendingAvatarId }));
      setShowAvatarModal(false);
      toast({ title: "Avatar actualizado ✓" });
    } catch {
      toast({ variant: "destructive", title: "Error al guardar el avatar" });
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "usuarios", user.uid));
      await deleteUser(user);
      toast({ title: "Cuenta eliminada", description: "Lamentamos verte partir. Tus datos han sido borrados." });
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({ 
          variant: "destructive", 
          title: "Acción Protegida", 
          description: "Por seguridad, debes cerrar sesión y volver a entrar para confirmar la eliminación de tu cuenta." 
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: "No pudimos eliminar la cuenta. Inténtalo más tarde." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePurchase = async () => {
    if (!user) return;
    setLoading(true);
    await registrarCompra(db, user.uid);
    setLoading(false);
    toast({ title: "¡Sello Acumulado!", description: "Has sumado un sello a tu Club Patio." });
  };

  const handleTestGeofence = async () => {
    if (!user || !userData) return;
    setLoading(true);
    await procesarProximidadGeofence(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0, true);
    setLoading(false);
  };

  const handleForceAINotif = async () => {
    if (!user || !userData) return;
    setLoading(true);
    await verificarYGenerarRecordatorioIA(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0);
    setLoading(false);
  };

  const handleDeleteNotif = async (notifId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "usuarios", user.uid, "notificaciones", notifId));
    } catch (e) {}
  };

  const handleOpenNotif = async (notif: any) => {
    if (!notif.leida && user) {
      try {
        await updateDoc(doc(db, "usuarios", user.uid, "notificaciones", notif.id), { leida: true });
      } catch (e) {
        console.error("Error marking notif as read", e);
      }
    }
    // handshake notifications always go to /validar regardless of stored actionUrl
    if (notif.tipo === "handshake") {
      router.push("/validar");
    } else if (notif.actionUrl) {
      router.push(notif.actionUrl);
    } else {
      setSelectedNotif(notif);
    }
  };

  const handleClearAllNotifs = async () => {
    if (!user || notificaciones.length === 0) return;
    if (!confirm("¿Deseas eliminar todos los mensajes de tu bandeja?")) return;
    
    try {
      const batchPromises = notificaciones.map(n => 
        deleteDoc(doc(db, "usuarios", user.uid, "notificaciones", n.id))
      );
      await Promise.all(batchPromises);
      toast({ title: "Bandeja limpiada", description: "Has eliminado todos tus mensajes." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la bandeja." });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (!user) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center bg-white p-10 rounded-2xl border border-border shadow-sm text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">¡Bienvenido al Club Patio!</h2>
            <p className="text-muted-foreground px-4">Inicia sesión para acumular sellos y participar en nuestros sorteos exclusivos.</p>
          </div>
          <Button onClick={onShowAuth} className="w-full rounded-xl h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20">
            <UserIcon className="w-5 h-5" /> Entrar al Club
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = hasRole(userData, "admin");
  const isEntrepreneur = hasRole(userData, "emprendedor");
  const isDirector = hasRole(userData, "director") || hasRole(userData, "director_patio");
  const sellos = userData?.comprasRealizadas || 0;
  const tickets = userData?.ticketsSorteo || 0;
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);
  const sellosRestantesParaPremio = 5 - (sellos % 5);
  const sellosHistoricos = userData?.sellosHistoricos ?? sellos;
  const rango = calcularRango(sellosHistoricos);
  const racha = userData?.rachaActual || 1;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      {/* Header Dinámico con Glassmorphism */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/50 border border-slate-100">
        <div
          className="h-[140px] relative overflow-hidden"
          style={{
            background: (isDirector && isEntrepreneur)
              ? "linear-gradient(135deg, #E0E7FF 0%, rgba(201,146,10,0.4) 50%, rgba(91,184,212,0.3) 100%)"
              : isEntrepreneur
                ? "linear-gradient(135deg, rgba(91,184,212,0.4) 0%, rgba(201,146,10,0.3) 100%)"
                : isDirector
                  ? "linear-gradient(135deg, #E0E7FF 0%, rgba(201,146,10,0.3) 100%)"
                  : "linear-gradient(135deg, #E8F4F8 0%, #D4EDD4 50%, #FFF8E8 100%)"
          }}
        >
          {/* Círculos decorativos animados */}
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white blur-3xl opacity-20" 
          />
          <motion.div 
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.15, 0.1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-primary blur-3xl opacity-10" 
          />
        </div>

        <div className="px-6 pb-8 -mt-12 relative z-10">
          <div className="flex justify-between items-end mb-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative group focus:outline-none"
              onClick={() => { setPendingAvatarId(editForm.avatarId); setShowAvatarModal(true); }}
              aria-label="Cambiar avatar"
            >
              <div
                style={{
                  width: "90px",
                  height: "90px",
                  borderRadius: "2rem",
                  background: "linear-gradient(135deg, #C9920A, #8DC63F)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "32px",
                  fontWeight: 800,
                  color: "white",
                  fontFamily: "'Montserrat', sans-serif",
                  border: "4px solid white",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                }}
              >
                {(() => {
                  const opt = AVATAR_OPTIONS.find(o => o.id === editForm.avatarId);
                  if (opt && opt.id !== "User") {
                    const Icon = opt.icon;
                    return <Icon className="w-10 h-10 text-white" />;
                  }
                  return getInitials(userData?.nombre);
                })()}
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-xl shadow-lg flex items-center justify-center border-2 border-slate-50 group-hover:bg-primary group-hover:border-primary transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-primary group-hover:text-white transition-colors" />
              </motion.div>
            </motion.button>

            {!isEditing ? (
              <div className="flex items-center gap-2">
                {!isEntrepreneur && (
                  <button
                    onClick={() => setShowProfileAI(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white font-black shadow-sm active:scale-95 transition-transform"
                    style={{ background: "linear-gradient(135deg,#6D28D9,#4F46E5)", fontSize: "10px" }}
                    aria-label="Abrir análisis IA"
                  >
                    <Sparkles className="w-3 h-3" /> IA
                  </button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-primary/20 text-primary bg-white/80 backdrop-blur-md shadow-sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Ajustes
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="rounded-full bg-white/80 backdrop-blur-md" onClick={() => setIsEditing(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{greeting}</span>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-none">
                  {userData?.nombre?.split(' ')[0] || "Miembro"}
                </h2>
                {isEntrepreneur && userData?.nombreTienda && (
                  <span className="text-base font-black leading-none" style={{ color: "#C9920A" }}>
                    🏪 {userData.nombreTienda}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-3">
              {isAdmin && <Badge className="bg-red-500 hover:bg-red-600 rounded-lg py-1 px-3 shadow-sm border-none">Master Admin</Badge>}
              {isDirector && <Badge className="bg-indigo-600 hover:bg-indigo-700 rounded-lg py-1 px-3 shadow-sm border-none">Director</Badge>}
              {isEntrepreneur && <Badge className="bg-primary hover:bg-primary/90 rounded-lg py-1 px-3 shadow-sm border-none">Emprendedor</Badge>}
              {!isAdmin && !isDirector && !isEntrepreneur && (
                <Badge
                  variant="outline"
                  className="rounded-lg py-1 px-3 border-slate-200 font-black text-sm gap-1"
                  style={{ color: rango.color, borderColor: `${rango.color}40` }}
                >
                  {rango.emoji} {rango.nombre}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Stats Rápidos */}
        {!isEditing && !isEntrepreneur && (
          <button
            className="w-full grid grid-cols-3 gap-px bg-slate-100/50 border-t border-slate-50 cursor-pointer active:bg-slate-50/80 transition-colors"
            onClick={() => setShowStatsInfo(true)}
            aria-label="Ver explicación de estadísticas"
          >
            <div className="p-4 bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center border-r border-slate-50 relative">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sellos</span>
              <span className="text-xl font-black text-primary">{sellos}</span>
              <Info className="absolute top-2 right-2 w-3 h-3 text-slate-300" />
            </div>
            <div className="p-4 bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center border-r border-slate-50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Racha</span>
              <span className="text-xl font-black" style={{ color: racha >= 3 ? "#f97316" : "#94a3b8" }}>
                {racha}{racha >= 3 ? "🔥" : "📅"}
              </span>
            </div>
            <div className="p-4 bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rango</span>
              <span className="text-xl font-black">{rango.emoji}</span>
            </div>
          </button>
        )}
      </div>

      {/* Banner: completar perfil para ganar sello */}
      {!isEditing && !isEntrepreneur && !userData?.perfilCompletoBonus &&
        !(Boolean(userData?.telefono?.trim()) && Boolean(userData?.fechaNacimiento?.trim())) && (
        <button
          onClick={() => setIsEditing(true)}
          className="w-full text-left flex items-center gap-4 rounded-2xl px-5 py-4 animate-in slide-in-from-top duration-300"
          style={{ background: "linear-gradient(135deg, #FEF9EC 0%, #FFFBF0 100%)", border: "1.5px solid #D3B673" }}
        >
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #D3B673, #C9920A)" }}>
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-amber-900">Completa tu perfil → +1 sello extra</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Agrega tu teléfono y fecha de nacimiento para recibir el bono.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
        </button>
      )}

      {isEditing && (
        <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden animate-in slide-in-from-top duration-300">
          <CardHeader className="bg-slate-50 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-primary" /> Editar Mis Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                {(() => {
                  const opt = AVATAR_OPTIONS.find(o => o.id === editForm.avatarId);
                  const Icon = opt ? opt.icon : UserIcon;
                  return (
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", opt?.color || "bg-slate-100 text-slate-600")}>
                      <Icon className="w-6 h-6" />
                    </div>
                  );
                })()}
                <div>
                  <p className="text-sm font-bold text-slate-700">Avatar actual</p>
                  <p className="text-xs text-slate-400">Toca para cambiarlo</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 text-primary border-primary/20 hover:bg-primary/5"
                onClick={() => { setPendingAvatarId(editForm.avatarId); setShowAvatarModal(true); }}
              >
                <Pencil className="w-3.5 h-3.5" /> Cambiar
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre Completo</Label>
                <Input
                  id="edit-nombre"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  placeholder="Tu nombre"
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-telefono">WhatsApp / Teléfono</Label>
                <Input
                  id="edit-telefono"
                  value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                  placeholder="+56 9 ..."
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fecha">Fecha de Nacimiento</Label>
                <Input
                  id="edit-fecha"
                  type="date"
                  value={editForm.fechaNacimiento}
                  onChange={(e) => setEditForm({ ...editForm, fechaNacimiento: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
            </div>

            {/* Indicador de bono por perfil completo */}
            {!hasRole(userData, "emprendedor") && !userData?.perfilCompletoBonus && (
              <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
                Boolean(editForm.telefono?.trim()) && Boolean(editForm.fechaNacimiento?.trim())
                  ? "bg-green-50 border border-green-200"
                  : "bg-amber-50 border border-amber-200"
              }`}>
                <Gift className={`w-5 h-5 shrink-0 ${
                  Boolean(editForm.telefono?.trim()) && Boolean(editForm.fechaNacimiento?.trim())
                    ? "text-green-600" : "text-amber-600"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black ${
                    Boolean(editForm.telefono?.trim()) && Boolean(editForm.fechaNacimiento?.trim())
                      ? "text-green-700" : "text-amber-700"
                  }`}>
                    {Boolean(editForm.telefono?.trim()) && Boolean(editForm.fechaNacimiento?.trim())
                      ? "¡Listo! Guardar te dará 1 sello extra"
                      : "Completa teléfono y nacimiento → +1 sello"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {[!editForm.telefono?.trim() && "Teléfono", !editForm.fechaNacimiento?.trim() && "Fecha de nacimiento"]
                      .filter(Boolean).join(" y ")}
                    {(Boolean(editForm.telefono?.trim()) && Boolean(editForm.fechaNacimiento?.trim())) ? "Bonus de bienvenida por completar tu perfil" : " pendiente"}
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveProfile}
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </Button>
          </CardContent>
        </Card>
      )}

      {isEditing && (
        <Card className="border-red-100 bg-red-50/30 rounded-2xl">
          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-xs font-bold uppercase">Zona de Peligro</p>
            </div>
            <p className="text-[11px] text-slate-500">¿Deseas eliminar permanentemente tu cuenta y todos tus sellos acumulados?</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full rounded-xl gap-2 font-bold h-10">
                  <Trash2 className="w-4 h-4" /> Eliminar mi cuenta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl max-w-[90%] md:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás totalmente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Perderás tus {sellos} sellos y el acceso a tus premios actuales.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2">
                  <AlertDialogCancel className="rounded-xl font-bold h-12">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-white rounded-xl font-bold h-12">Sí, eliminar cuenta</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* ── Banner iOS: instalar como PWA ─────────────────────────────────── */}
      {showIosHint && !isEditing && (
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-4 flex items-start gap-4 animate-in slide-in-from-top-2 duration-500"
          style={{
            background: "linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          }}
        >
          {/* Botón cerrar */}
          <button
            onClick={() => setShowIosHint(false)}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Ícono */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #D3B673, #C9920A)" }}
          >
            <Bell className="w-5 h-5 text-white" />
          </div>

          {/* Texto */}
          <div className="space-y-1.5 flex-1 pr-4">
            <p className="text-sm font-black text-white leading-snug">
              Instala la app para recibir notificaciones 🔔
            </p>
            <p className="text-[11px] text-white/60 leading-relaxed">
              En iPhone, las alertas solo llegan si la app está en tu pantalla de inicio.
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-[#D3B673]">
              <span>Toca</span>
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded bg-white/10 text-white text-[10px] font-black"
                style={{ fontFamily: "system-ui" }}
              >⎙</span>
              <span>→</span>
              <span className="italic">&quot;Añadir a pantalla de inicio&quot;</span>
              <span>→</span>
              <span className="italic">&quot;Añadir&quot;</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner push: activar / bloqueado ─────────────────────────────── */}
      {!pushEnabled && !isEditing && !showIosHint && !isEntrepreneur && !notifBannerDismissed && (
        <Card className={`border-none shadow-md rounded-2xl ${notifDenied ? "bg-red-50/60" : "bg-blue-50/50"}`}>
          <CardContent className="p-4 space-y-3">
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notifDenied ? "bg-red-100 text-red-500" : "bg-blue-500/10 text-blue-600"}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-xs font-black ${notifDenied ? "text-red-700" : "text-blue-800"}`}>
                    {notifDenied ? "Notificaciones bloqueadas" : "Activa las notificaciones"}
                  </p>
                  <p className={`text-[11px] font-medium ${notifDenied ? "text-red-500" : "text-blue-500"}`}>
                    {notifDenied ? "Actívalas desde Ajustes del sistema" : "Recibe avisos de sellos y premios"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setNotifBannerDismissed(true);
                  localStorage.setItem("notif_banner_dismissed", "true");
                }}
                className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action */}
            {notifDenied ? (
              <div className="bg-red-100/60 rounded-xl px-3 py-2">
                <p className="text-[11px] font-bold text-red-700">
                  {/iphone|ipad|ipod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "")
                    ? "Ajustes → Safari → Notificaciones → Activar"
                    : /android/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "")
                    ? "Configuración → Aplicaciones → [Navegador] → Notificaciones → Activar"
                    : "Candado (barra URL) → Notificaciones → Permitir"}
                </p>
                <p className="text-[10px] text-red-400 mt-0.5">Vuelve a la app después — se actualizará solo.</p>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={requestNotificationPermission}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold h-9"
              >
                Activar notificaciones
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <section className="bg-slate-100/50 p-4 rounded-3xl border border-slate-200 border-dashed space-y-3">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <FlaskConical className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest">Zona de Pruebas (Admin Only)</h4>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handleTestGeofence} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Navigation className="w-3 h-3" /> Proximidad</Button>
            <Button onClick={handleForceAINotif} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Sparkles className="w-3 h-3" /> Generar IA</Button>
            <Button onClick={handleSimulatePurchase} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Gift className="w-3 h-3" /> Sumar Sello</Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-[9px] bg-white h-10 gap-1 font-bold border-amber-200 text-amber-700 hover:bg-amber-50"
            disabled={loading}
            onClick={async () => {
              if (!user) return;
              if (!confirm("¿Generar códigos de referido para todos los usuarios que no tienen? Esta acción es irreversible.")) return;
              setLoading(true);
              try {
                const token = await user.getIdToken();
                const res = await fetch("/api/admin/generar-codigos-referido", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok) {
                  toast({ title: "¡Listo!", description: `${data.actualizados} usuarios actualizados, ${data.omitidos} ya tenían código.${data.errores.length ? ` ${data.errores.length} errores.` : ""}` });
                } else {
                  toast({ variant: "destructive", title: "Error", description: data.error });
                }
              } catch {
                toast({ variant: "destructive", title: "Error de red" });
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
            Generar códigos referido a todos
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-[9px] bg-white h-10 gap-1 font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
            disabled={loading}
            onClick={async () => {
              if (!user) return;
              if (!confirm("¿Calcular sellosHistoricos para todos los usuarios sin él? Esto lee sus canjes históricos.")) return;
              setLoading(true);
              try {
                const token = await user.getIdToken();
                const res = await fetch("/api/admin/migrar-sellos-historicos", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.ok) {
                  toast({ title: "Migración completada", description: `${data.actualizados} usuarios migrados, ${data.omitidos} ya tenían el campo.${data.errores.length ? ` ${data.errores.length} errores.` : ""}` });
                } else {
                  toast({ variant: "destructive", title: "Error", description: data.error });
                }
              } catch {
                toast({ variant: "destructive", title: "Error de red" });
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />}
            Migrar sellos históricos + rangos
          </Button>
        </section>
      )}

      {isDirector && (
        <section className="space-y-4 animate-in slide-in-from-bottom duration-500">
          <Card className="border-indigo-100 shadow-xl bg-white rounded-3xl overflow-hidden border-2">
            <CardHeader className="bg-indigo-50/50 pb-4">
              <CardTitle className="text-lg font-black flex items-center gap-2 text-indigo-900">
                <Trophy className="w-5 h-5 text-indigo-600" /> 
                Gestión Directiva
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Tienes acceso al panel de control global para monitorear la salud del recinto, gestionar premios y enviar comunicados.
                </p>
                <Link href="/director">
                  <Button className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg gap-3 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                    <LayoutDashboard className="w-6 h-6" /> 
                    Abrir Panel Directivo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {isEntrepreneur && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5"
        >
          {/* QR Universal — vista central */}
          <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
            <CardContent className="flex flex-col items-center py-8 px-6 gap-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Tu código QR universal</p>
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-5 bg-white rounded-[1.5rem] shadow-lg border border-slate-100 relative"
              >
                <QRCode
                  value={user.uid
                    ? `${typeof window !== "undefined" ? window.location.origin : "https://clubpatiocurauma.synaptechspa.cl"}/scan?ref=${user.uid}`
                    : "invalid"}
                  size={210}
                  fgColor="#1A1A1A"
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
                <motion.div
                  className="absolute -top-3 -right-3 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg text-white border-4 border-white"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <QrCode className="w-5 h-5" />
                </motion.div>
              </motion.div>

              {/* Métricas duales */}
              <div className="w-full grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl px-4 py-4 flex flex-col gap-1"
                  style={{ background: "linear-gradient(135deg, #f8f9fa, #f1f3f5)", border: "1px solid rgba(0,0,0,0.04)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: "linear-gradient(135deg, rgba(157,204,101,0.15), rgba(157,204,101,0.25))" }}
                  >
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-2xl font-black text-primary leading-none">
                    {userData?.sellosEntregadosHistorico ?? 0}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sellos</p>
                  <p className="text-[10px] text-slate-400">entregados</p>
                </div>
                <div
                  className="rounded-2xl px-4 py-4 flex flex-col gap-1"
                  style={{ background: "linear-gradient(135deg, #f8f9fa, #f1f3f5)", border: "1px solid rgba(0,0,0,0.04)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: "linear-gradient(135deg, rgba(110,187,209,0.15), rgba(110,187,209,0.25))" }}
                  >
                    <Users className="w-5 h-5 text-[#6EBBD1]" />
                  </div>
                  <p className="text-2xl font-black text-[#6EBBD1] leading-none">
                    {userData?.clientesNuevosRegistrados ?? 0}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Socios</p>
                  <p className="text-[10px] text-slate-400">captados</p>
                </div>
              </div>

              <p className="text-[11px] text-center text-slate-400 leading-relaxed">
                Muéstrale este QR a tus clientes. Los nuevos se registran y los recurrentes suman un sello automáticamente.
              </p>
            </CardContent>
          </Card>

          {/* Acciones discretas */}
          <div className="grid grid-cols-3 gap-3">
            {user && (
              <Link href={`/validar/${user.uid}`} className="col-span-1">
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full h-14 rounded-2xl font-bold gap-1.5 shadow-sm border-none text-white text-[11px] flex-col"
                    style={{ background: "linear-gradient(135deg, #D3B673, #C9920A)" }}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Validar
                  </Button>
                </motion.div>
              </Link>
            )}
            <Link href="/vendedor" className="col-span-1">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button variant="outline" className="w-full h-14 rounded-2xl border-slate-100 bg-slate-50/50 text-slate-600 font-bold text-[11px] gap-1.5 flex-col hover:bg-white hover:border-primary/20">
                  <LayoutDashboard className="w-4 h-4 text-primary" /> Panel
                </Button>
              </motion.div>
            </Link>
            <Link href="/tienda" className="col-span-1">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className="w-full h-14 rounded-2xl border-slate-100 bg-slate-50/50 text-slate-600 font-bold text-[11px] gap-1.5 flex-col hover:bg-white hover:border-primary/20"
                >
                  <Store className="w-4 h-4 text-slate-400" /> Mi Tienda
                </Button>
              </motion.div>
            </Link>
          </div>

          {/* Mensajes del Club */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-primary">Mensajes del Club</h3>
              </div>
              {notificaciones.length > 0 && (
                <Button variant="ghost" size="icon" onClick={handleClearAllNotifs} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" title="Borrar todos">
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
            {selectedNotif && (
              <NotifDetailModal notif={selectedNotif} onClose={() => setSelectedNotif(null)} />
            )}
            <div className="space-y-3">
              {notificaciones.length > 0 ? (
                <>
                  {notificaciones.slice(0, 4).map((notif) => (
                    <SwipeableNotification key={notif.id} notif={notif} onDelete={handleDeleteNotif} onOpen={handleOpenNotif} />
                  ))}
                  {notificaciones.length > 4 && (
                    <p
                      style={{ textAlign: "center", fontSize: "13px", color: "#C9920A", cursor: "pointer", padding: "8px" }}
                      onClick={() => router.push("/mensajes")}
                    >
                      Ver todos los mensajes →
                    </p>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 p-8 rounded-3xl text-center space-y-2 border-2 border-dashed border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium italic">Pronto recibirás promociones exclusivas.</p>
                </div>
              )}
            </div>
          </section>
        </motion.div>
      )}

      {!isEntrepreneur && !isDirector && !isAdmin && !isEditing && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* ── Tarjeta de Rango + Progreso ─────────────────────────────────── */}
          <div
            className="rounded-[2rem] p-6 space-y-4 overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 blur-[80px] pointer-events-none" style={{ background: rango.color, opacity: 0.15 }} />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Tu rango actual</p>
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{rango.emoji}</span>
                  <span className="text-2xl font-black text-white">{rango.nombre}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: racha >= 3 ? "#f97316" : "rgba(255,255,255,0.4)" }}>
                  Racha
                </p>
                <p className="text-2xl font-black text-white">
                  {racha}{racha >= 7 ? "🔥" : racha >= 3 ? "🔥" : "📅"}
                </p>
                <p className="text-[10px] text-white/30">{racha === 1 ? "día" : "días"}</p>
              </div>
            </div>

            {rango.siguiente !== null && (
              <div className="relative z-10 space-y-2">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-white/50">Progreso a {rango.siguiente >= 100 ? "💎 Platino" : rango.siguiente >= 50 ? "🏆 Oro" : rango.siguiente >= 15 ? "⭐ Plata" : "🥉 Bronce"}</span>
                  <span style={{ color: rango.color }}>{sellos} / {rango.siguiente}</span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${rango.progreso}%`,
                      background: `linear-gradient(90deg, ${rango.color}, ${rango.color}cc)`,
                      borderRadius: 8,
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/30">
                  Te faltan <span className="font-black" style={{ color: rango.color }}>{rango.siguiente - sellos} sellos</span> para subir de rango
                </p>
              </div>
            )}

            {rango.siguiente === null && (
              <div className="relative z-10 text-center py-2">
                <p className="text-sm font-black text-white/80">¡Alcanzaste el rango máximo! 💎</p>
                <p className="text-[11px] text-white/40 mt-1">Eres parte de la élite del Club Patio</p>
              </div>
            )}
          </div>

          {/* ── Acciones Rápidas ───────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: "📷", label: "Escanear", href: "/scan", color: "#9DCC65" },
              { icon: "🎁", label: "Premios", href: "/premios", color: "#D3B673" },
              { icon: "🗺️", label: "Mi Ruta", href: "/ruta", color: "#2D6A4F" },
              { icon: "📤", label: "Referir", href: null, color: "#C9920A" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  if (action.href) {
                    router.push(action.href);
                    return;
                  }
                  // Botón Referir: scroll a la sección y/o compartir
                  const seccion = document.getElementById("seccion-referido");
                  if (seccion) {
                    seccion.scrollIntoView({ behavior: "smooth", block: "center" });
                    return;
                  }
                  // Fallback si no tiene código aún
                  if (userData?.codigoReferido) {
                    const msg = `¡Únete al Club Patio Curauma! Usa mi código *${userData.codigoReferido}* al registrarte y ambos ganamos 1 sello extra: https://clubpatiocurauma.synaptechspa.cl/unete`;
                    if (typeof navigator.share === "function") {
                      navigator.share({ title: "Club Patio Curauma", text: msg }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(msg).then(() => toast({ title: "¡Copiado!" }));
                    }
                  } else {
                    toast({ title: "Código de referido", description: "Tu código de referido se genera automáticamente al registrarte." });
                  }
                }}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-white shadow-sm border border-slate-100 active:scale-95 transition-transform hover:shadow-md"
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{action.label}</span>
              </button>
            ))}
          </div>

          <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <CardContent className="flex flex-col items-center py-10 relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Muestra tu QR en caja</p>
              </div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="p-6 bg-white rounded-[2rem] shadow-xl border border-slate-50 flex items-center justify-center relative"
              >
                <QRCode value={user.uid} size={180} fgColor="#1A1A1A" style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                <motion.div 
                  className="absolute -top-3 -right-3 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg text-white border-4 border-white"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <QrCode className="w-5 h-5" />
                </motion.div>
              </motion.div>
              
              <div className="mt-8 flex flex-col items-center gap-2">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                      <Star className="w-3 h-3 text-primary fill-primary" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-bold text-slate-400">Úsalo en locales adheridos</p>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-primary">Mensajes del Club</h3>
              </div>
              {notificaciones.length > 0 && (
                <Button variant="ghost" size="icon" onClick={handleClearAllNotifs} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" title="Borrar todos">
                   <X className="w-5 h-5" />
                </Button>
              )}
            </div>
            {selectedNotif && (
              <NotifDetailModal notif={selectedNotif} onClose={() => setSelectedNotif(null)} />
            )}
            <div className="space-y-3">
              {notificaciones.length > 0 ? (
                <>
                  {notificaciones.slice(0, 4).map((notif) => (
                    <SwipeableNotification key={notif.id} notif={notif} onDelete={handleDeleteNotif} onOpen={handleOpenNotif} />
                  ))}
                  {notificaciones.length > 4 && (
                    <p
                      style={{ textAlign: "center", fontSize: "13px", color: "#C9920A", cursor: "pointer", padding: "8px" }}
                      onClick={() => router.push("/mensajes")}
                    >
                      Ver todos los mensajes →
                    </p>
                  )}
                </>
              ) : (
                <div className="bg-slate-50 p-8 rounded-3xl text-center space-y-2 border-2 border-dashed border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium italic">Pronto recibirás promociones exclusivas.</p>
                </div>
              )}
            </div>
          </section>

          {userData?.sellosLocales && Object.keys(userData.sellosLocales).length > 0 && (
            <FavoriteShops sellosLocales={userData.sellosLocales} />
          )}

          {user && <ActivityFeed userId={user.uid} />}
        </motion.div>
      )}

      {showPermisos && <PermissionsModal onClose={() => setShowPermisos(false)} />}
      {showReferralInfo && <ReferralInfoModal onClose={() => setShowReferralInfo(false)} />}
      {showStatsInfo && (
        <StatsInfoModal
          sellos={sellos}
          sellosHistoricos={sellosHistoricos}
          racha={racha}
          rachaMaxima={userData?.rachaMaxima || racha}
          rango={rango}
          onClose={() => setShowStatsInfo(false)}
        />
      )}

      {/* ── Código de Referido ─────────────────────────────────────────────── */}
      {userData?.codigoReferido && !isEditing && (
        <motion.div
          id="seccion-referido"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-[2.5rem] overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(211,182,115,0.2)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}
        >
          {/* Luz de fondo sutil */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D3B673] opacity-10 blur-[60px] pointer-events-none" />
          
          <div className="px-7 pt-7 pb-4 flex items-center gap-4 relative z-10">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
              style={{ background: "linear-gradient(135deg, #D3B673, #C9920A)" }}
            >
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-white leading-tight">Programa de Referidos</p>
              <p className="text-[12px] text-white/50 leading-tight mt-1">
                Gana <span className="text-[#D3B673] font-bold">1 sello gratis</span> por cada amigo
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowReferralInfo(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
              title="¿Cómo funciona?"
            >
              <Info className="w-4 h-4" />
            </motion.button>
          </div>

          <div className="px-7 pb-7 space-y-4 relative z-10">
            <div
              className="flex items-center justify-between rounded-2xl px-5 py-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span
                className="text-2xl font-black tracking-[0.2em]"
                style={{ color: "#D3B673", fontFamily: "monospace" }}
              >
                {userData.codigoReferido}
              </span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  navigator.clipboard.writeText(userData.codigoReferido).then(() => {
                    toast({ title: "¡Copiado!", description: "Código copiado al portapapeles." });
                  });
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                style={{ background: "rgba(211,182,115,0.2)", color: "#D3B673" }}
              >
                <Copy className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="flex items-center justify-center gap-6 py-2">
               <div className="text-center">
                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Referidos</p>
                  <p className="text-xl font-black text-[#D3B673]">{userData.referidosExitosos || 0}</p>
               </div>
               <div className="w-px h-8 bg-white/10" />
               <div className="text-center">
                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Bonus</p>
                  <p className="text-xl font-black text-primary">{(userData.referidosExitosos || 0)} <span className="text-[10px]">🎟️</span></p>
               </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const msg = `¡Únete al Club Patio Curauma y gana sellos y premios! Usa mi código de referido *${userData.codigoReferido}* al registrarte y ambos ganamos 1 sello extra: https://clubpatiocurauma.synaptechspa.cl/unete`;
                if (typeof navigator.share === "function") {
                  navigator.share({ title: "Club Patio Curauma", text: msg }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(msg).then(() => {
                    toast({ title: "¡Mensaje copiado!", description: "Pégalo donde quieras compartirlo." });
                  });
                }
              }}
              className="w-full h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl"
              style={{
                background: "linear-gradient(135deg, #D3B673, #C9920A)",
                color: "white",
                boxShadow: "0 10px 25px rgba(201,146,10,0.4)",
              }}
            >
              <Share2 className="w-5 h-5" />
              Compartir Invitación
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* ── Configuración de permisos ── */}
      <button
        onClick={() => setShowPermisos(true)}
        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(211,182,115,0.12)", color: "#D3B673" }}>
            <Bell className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Configuración de permisos</p>
            <p className="text-[11px] text-slate-400 font-medium">Notificaciones, ubicación y cámara</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </button>

      {/* FOOTER DE CUMPLIMIENTO APP STORE */}
      <section className="px-8 space-y-4 pt-6">
        {/* Botón de sugerencias */}
        <button
          onClick={() => { setShowSugerencias(true); setSugerenciaEnviada(false); setSugerenciaTexto(""); setSugerenciaCategoria("mejora"); }}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
            <MessageSquare className="w-4 h-4" style={{ color: "#D3B673" }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900">Enviar sugerencia</p>
            <p className="text-[11px] text-slate-400 font-medium">Ayúdanos a mejorar la app</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
        </button>

        <div className="flex flex-col gap-3">
          <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-primary transition-colors">
            POLÍTICA DE PRIVACIDAD <ExternalLink className="w-3 h-3" />
          </Link>
          <Link href="/terminos" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-primary transition-colors">
            TÉRMINOS Y CONDICIONES <ExternalLink className="w-3 h-3" />
          </Link>
          <Link href="/acerca" className="flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-primary transition-colors">
            ACERCA DE <Info className="w-3 h-3" />
          </Link>
        </div>
        <Separator className="bg-slate-100" />
        <div className="text-center">
          <Button onClick={handleLogout} variant="ghost" className="font-bold text-xs gap-2" style={{ color: "#666666" }}><LogOut className="w-4 h-4" /> Cerrar Sesión del Club</Button>
          <p className="text-[10px] text-slate-400 font-light mt-4">© {new Date().getFullYear()} {PATIO_INFO.name}</p>
        </div>
      </section>
      {/* ── Modal de Sugerencias ─────────────────────────────────────────── */}
      {showSugerencias && (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSugerencias(false)}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

            <div className="px-7 pt-5 pb-4 flex items-start justify-between shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-800">Enviar sugerencia</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Tu feedback llega directo al equipo</p>
              </div>
              <button
                onClick={() => setShowSugerencias(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-px bg-slate-100 mx-7 shrink-0" />

            {sugerenciaEnviada ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-7 py-12 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(157,204,101,0.15)" }}>
                  <CheckCircle2 className="w-8 h-8" style={{ color: "#9DCC65" }} />
                </div>
                <div>
                  <p className="text-lg font-black text-slate-800">¡Gracias por tu feedback!</p>
                  <p className="text-sm text-slate-400 font-medium mt-1">El equipo revisará tu sugerencia pronto.</p>
                </div>
                <button
                  onClick={() => setShowSugerencias(false)}
                  className="mt-2 h-12 px-8 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98]"
                  style={{ backgroundColor: "#D3B673" }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto px-7 py-5 flex-1 flex flex-col gap-5">
                {/* Categoría */}
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Tipo</p>
                  <div className="flex gap-2">
                    {([
                      { key: "mejora",   label: "💡 Mejora",   color: "#d97706", bg: "#fef3c7" },
                      { key: "problema", label: "🐛 Problema",  color: "#dc2626", bg: "#fee2e2" },
                      { key: "otro",     label: "💬 Otro",      color: "#6366f1", bg: "#ede9fe" },
                    ] as const).map(({ key, label, color, bg }) => (
                      <button
                        key={key}
                        onClick={() => setSugerenciaCategoria(key)}
                        className="flex-1 py-2 rounded-xl text-xs font-black transition-all border-2"
                        style={
                          sugerenciaCategoria === key
                            ? { backgroundColor: bg, color, borderColor: color }
                            : { backgroundColor: "#f8fafc", color: "#94a3b8", borderColor: "transparent" }
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Texto */}
                <div className="space-y-2 flex-1">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Tu sugerencia</p>
                  <textarea
                    value={sugerenciaTexto}
                    onChange={(e) => setSugerenciaTexto(e.target.value)}
                    placeholder="Escribe aquí tu idea, mejora o problema que encontraste…"
                    maxLength={500}
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                  <p className="text-[10px] text-slate-400 text-right">{sugerenciaTexto.length}/500</p>
                </div>
              </div>
            )}

            {!sugerenciaEnviada && (
              <div className="px-7 py-5 shrink-0 border-t border-slate-100">
                <button
                  disabled={sugerenciaTexto.trim().length < 10 || sugerenciaLoading}
                  onClick={async () => {
                    if (!user || sugerenciaTexto.trim().length < 10) return;
                    setSugerenciaLoading(true);
                    try {
                      await addDoc(collection(db, "sugerencias"), {
                        userId: user.uid,
                        userName: userData?.nombre || user.displayName || "Anónimo",
                        userEmail: user.email || "",
                        texto: sugerenciaTexto.trim(),
                        categoria: sugerenciaCategoria,
                        fecha: new Date().toISOString(),
                        leida: false,
                      });
                      setSugerenciaEnviada(true);
                    } catch {
                      toast({ variant: "destructive", title: "Error", description: "No se pudo enviar la sugerencia. Intenta de nuevo." });
                    } finally {
                      setSugerenciaLoading(false);
                    }
                  }}
                  className="w-full h-12 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#D3B673" }}
                >
                  {sugerenciaLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                    : <><MessageSquare className="w-4 h-4" /> Enviar sugerencia</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Selector de Avatar ──────────────────────────────────────── */}
      {showAvatarModal && (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowAvatarModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col"
            style={{ maxHeight: "80dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + Header */}
            <div className="px-6 pt-5 pb-4 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Selecciona tu Avatar</h2>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Elige el icono que mejor te represente</p>
                </div>
                <button
                  onClick={() => setShowAvatarModal(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid de avatares */}
            <div className="px-6 overflow-y-auto flex-1 pb-4">
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = pendingAvatarId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPendingAvatarId(opt.id)}
                      className={cn(
                        "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all p-3 shadow-sm border-2",
                        opt.color,
                        isSelected
                          ? "border-primary ring-2 ring-primary ring-offset-1 scale-105 shadow-md"
                          : "border-transparent hover:border-slate-200"
                      )}
                    >
                      <Icon className="w-7 h-7" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer fijo */}
            <div className="px-6 pt-3 pb-8 shrink-0 border-t border-slate-100 space-y-2">
              <Button
                className="w-full h-12 rounded-2xl font-bold gap-2"
                onClick={handleSaveAvatar}
                disabled={savingAvatar}
              >
                {savingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar Avatar
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 rounded-2xl text-slate-400 text-sm"
                onClick={() => setShowAvatarModal(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>

    <AIAssistantModal
      isOpen={showProfileAI}
      onClose={() => setShowProfileAI(false)}
      userData={userData}
      insights={generarInsightosSocio(userData)}
    />
    </>
  );
}
