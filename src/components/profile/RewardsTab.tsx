"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { User } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Sparkles, Award, Stamp, WifiOff } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CatalogoPremios } from "./CatalogoPremios";
import { motion, AnimatePresence } from "framer-motion";

interface RewardsTabProps {
  user: User | null;
  userData: any;
  onShowAuth: () => void;
}

export function RewardsTab({ user, userData, onShowAuth }: RewardsTabProps) {
  const [showStampAnim, setShowStampAnim] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof window !== "undefined" ? !navigator.onLine : false
  );
  const prevSellosRef = useRef<number | null>(null);

  // Detectar cambios de conectividad
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // FIX: useMemo evita leer localStorage en cada render
  const cachedData = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("cached_stamp_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo se lee una vez al montar — luego se actualiza vía el efecto de escritura

  const sellos = userData?.comprasRealizadas ?? cachedData?.sellos ?? 0;
  const tickets = userData?.ticketsSorteo ?? cachedData?.tickets ?? 0;
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);
  const sellosRestantesParaPremio = 5 - (sellos % 5);

  // FIX: usar campos primitivos como dep, no el objeto userData completo
  const comprasRealizadas = userData?.comprasRealizadas;
  const ticketsSorteo = userData?.ticketsSorteo;
  const nombreUsuario = userData?.nombre;

  useEffect(() => {
    if (!isOffline && userData) {
      localStorage.setItem(
        "cached_stamp_data",
        JSON.stringify({
          sellos: comprasRealizadas || 0,
          tickets: ticketsSorteo || 0,
          nombre: nombreUsuario || "Miembro",
        })
      );
    }
  // FIX: deps son valores primitivos, no el objeto userData
  }, [isOffline, comprasRealizadas, ticketsSorteo, nombreUsuario]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX: siempre actualizar prevSellosRef, incluso cuando dispara la animación
  useEffect(() => {
    if (prevSellosRef.current !== null && sellosEnTarjeta > prevSellosRef.current) {
      setShowStampAnim(true);
      const t = setTimeout(() => setShowStampAnim(false), 1600);
      prevSellosRef.current = sellosEnTarjeta; // FIX: actualizar ref en AMBAS ramas
      return () => clearTimeout(t);
    }
    prevSellosRef.current = sellosEnTarjeta;
  }, [sellosEnTarjeta]);

  if (!user) {
    return (
      <div className="pt-6 px-4 bg-white min-h-screen text-center space-y-6">
        <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 mt-10">
          <GiftIcon size={48} className="mx-auto text-primary mb-4" />
          <h2 className="text-xl font-black text-primary mb-2">Descubre tus Beneficios</h2>
          <p className="text-sm text-muted-foreground mb-6">Únete al club para acumular sellos y canjear premios exclusivos en todos nuestros locales.</p>
          <Button onClick={onShowAuth} className="w-full rounded-2xl h-14 text-lg font-bold">Unirme al Club</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 px-4 bg-white pb-24 space-y-6 animate-in fade-in duration-300">
      <header className="px-2 pb-2">
        <h1 className="text-2xl font-black text-slate-800">Mis Beneficios</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Club Patio Curauma</p>
      </header>

      {/* Banner offline */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50"
          >
            <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs font-bold text-amber-800 leading-snug">
              Modo consulta: Conéctate para actualizar tus puntos.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-none shadow-lg bg-gradient-to-br from-primary to-accent/40 rounded-3xl overflow-hidden text-white">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Gran Sorteo del Mes</p>
            <h3 className="text-2xl font-black flex items-center gap-2"><Trophy className="w-6 h-6 text-yellow-300" />{tickets} <span className="text-sm font-bold opacity-90">Tickets</span></h3>
          </div>
          <Sparkles className="w-10 h-10 opacity-20" />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h3 className="font-bold text-lg text-primary flex items-center gap-2 px-1"><Award className="w-5 h-5" />Mi Tarjeta de Sellos</h3>
        <Card className="border-none shadow-xl bg-[#FDFCF0] rounded-[2rem] overflow-hidden relative">
          {/* Animación de sello */}
          <AnimatePresence>
            {showStampAnim && (
              <>
                {/* Destello verde */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.45, 0] }}
                  transition={{ duration: 1.2, times: [0, 0.25, 1] }}
                  className="absolute inset-0 z-10 pointer-events-none rounded-[2rem]"
                  style={{ backgroundColor: "#9DCC65" }}
                />
                {/* Icono de sello estampado */}
                <motion.div
                  initial={{ scale: 3, rotate: -40, opacity: 0, y: -60 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1, y: 0 }}
                  exit={{ scale: 0.6, opacity: 0, y: 30 }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                  className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                >
                  <div
                    className="rounded-full p-5 shadow-2xl"
                    style={{ backgroundColor: "#9DCC65" }}
                  >
                    <Stamp className="w-14 h-14 text-white" />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <CardContent className="p-8">
            {/* Barra de progreso */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-widest">Progreso</span>
                <span className="text-[11px] font-bold text-slate-500">
                  <span className="text-[#C9A84C] text-sm font-black">{sellosEnTarjeta}</span>
                  {" "}de 10 sellos
                </span>
              </div>
              <div className="h-2.5 w-full bg-primary/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(sellosEnTarjeta / 10) * 100}%`,
                    background: "linear-gradient(90deg, #C9A84C, #D3B673)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square relative flex items-center justify-center">
                  <img
                    src="/Logo2.png"
                    alt={i < sellosEnTarjeta ? "Sello completado" : "Sello pendiente"}
                    className="w-full h-full object-contain"
                    style={i < sellosEnTarjeta
                      ? { mixBlendMode: "multiply" }
                      : { filter: "grayscale(100%) opacity(30%)", mixBlendMode: "multiply" }}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-4 text-center">
              <p className="text-primary font-bold text-lg leading-tight px-4">{sellos % 5 === 0 && sellos > 0 ? "¡Tienes un premio listo para canjear!" : `¡Te faltan ${sellosRestantesParaPremio === 5 ? 5 : sellosRestantesParaPremio} sellos para tu próximo premio!`}</p>
              <Button className="w-full h-12 rounded-2xl bg-primary text-white font-bold" onClick={() => document.getElementById('premios-catalogo')?.scrollIntoView({ behavior: 'smooth' })}>Canjear Sellos por Premios</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden mt-6">
        <CardContent className="flex flex-col items-center py-8">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-4">Escanea esto en el local</p>
          <div className="p-4 bg-white border-2 border-primary/5 rounded-3xl shadow-inner flex items-center justify-center">
            <QRCode value={user.uid} size={176} fgColor="#000000" style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
          </div>
        </CardContent>
      </Card>

      <div id="premios-catalogo">
        <CatalogoPremios userId={user.uid} userEmail={user.email || undefined} comprasActuales={sellos} />
      </div>
    </div>
  );
}

function GiftIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect width="20" height="5" x="2" y="7" />
      <line x1="12" x2="12" y1="22" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}
