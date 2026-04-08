"use client";

import { User } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Sparkles, Award, CheckCircle2 } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CatalogoPremios } from "./CatalogoPremios";

interface RewardsTabProps {
  user: User | null;
  userData: any;
  onShowAuth: () => void;
}

export function RewardsTab({ user, userData, onShowAuth }: RewardsTabProps) {
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

  const sellos = userData?.comprasRealizadas || 0;
  const tickets = userData?.ticketsSorteo || 0;
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);
  const sellosRestantesParaPremio = 5 - (sellos % 5);

  return (
    <div className="pt-4 px-4 bg-white pb-24 space-y-6 animate-in fade-in duration-300">
      <header className="px-2 pb-2">
        <h1 className="text-2xl font-black text-slate-800">Mis Beneficios</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Club Patio Curauma</p>
      </header>

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
          <CardContent className="p-8">
            <div className="grid grid-cols-5 gap-4 mb-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square relative flex items-center justify-center">
                  <div className={cn("w-full h-full rounded-full flex items-center justify-center", i < sellosEnTarjeta ? "bg-white shadow-inner" : "bg-primary/5 border-2 border-dashed border-primary/20")}>
                    {i < sellosEnTarjeta ? <CheckCircle2 className="w-8 h-8 text-primary fill-primary/10" /> : <span className="text-[10px] font-bold text-primary/20">{i + 1}</span>}
                  </div>
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
            <QRCode value={user.uid} size={176} fgColor="#4EAD1F" style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
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
