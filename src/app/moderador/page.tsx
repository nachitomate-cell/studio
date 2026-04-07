
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, Settings, UserCog, Database, 
  ArrowLeft, Search, MoreVertical, Store,
  AlertTriangle, Lock, Unlock
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export default function ModeradorPage() {
  const router = useRouter();

  const emprendedores = [
    { id: 'e1', nombre: 'Aromavida', estado: 'activo', sellos: 154 },
    { id: 'e2', nombre: 'Curauma Sabor', estado: 'activo', sellos: 230 },
    { id: 'e3', nombre: 'Alfo Accesorios', estado: 'revision', sellos: 89 },
  ];

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 pb-20">
      <div className="bg-slate-800 border-b border-slate-700 p-6 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Master Admin</h1>
              <p className="text-[8px] text-primary font-bold uppercase tracking-widest">Soporte Master - ignaciiio.mate@gmail.com</p>
            </div>
          </div>
          <Settings className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* Warning Banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-200 leading-relaxed font-medium">
            Estás en modo Master. Cualquier cambio impactará directamente en la base de datos de producción de Patio Curauma.
          </p>
        </div>

        {/* Buscador de Sistema */}
        <section className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Buscar socio, emprendedor o ID..." 
              className="bg-slate-800 border-slate-700 rounded-xl pl-11 h-12 text-slate-200 focus:ring-primary"
            />
          </div>
        </section>

        {/* Herramientas Rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-20 rounded-2xl border-slate-700 bg-slate-800/50 flex-col gap-2 hover:bg-slate-800">
            <UserCog className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold uppercase">Roles</span>
          </Button>
          <Button variant="outline" className="h-20 rounded-2xl border-slate-700 bg-slate-800/50 flex-col gap-2 hover:bg-slate-800">
            <Database className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] font-bold uppercase">Backup</span>
          </Button>
        </div>

        {/* Gestión de Emprendedores */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Control de Emprendedores</h2>
            <Badge className="bg-primary/20 text-primary border-none">3 Aliados</Badge>
          </div>
          
          <div className="space-y-2">
            {emprendedores.map((emp) => (
              <div key={emp.id} className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                    <Store className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{emp.nombre}</p>
                    <p className="text-[10px] text-slate-500">{emp.sellos} sellos emitidos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-slate-500"><Unlock className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-slate-500"><MoreVertical className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Logs Críticos */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Logs del Servidor</h2>
          <div className="bg-black rounded-2xl p-4 font-mono text-[9px] text-green-500/80 space-y-1 border border-slate-800">
            <p>[SYSTEM] Firebase Auth: user_login success (jdoe@...)</p>
            <p>[DATABASE] Update: /usuarios/uid/comprasRealizadas (+1)</p>
            <p className="text-amber-500">[WARN] Geofence: high latency detected (320ms)</p>
            <p>[SYSTEM] Genkit: flow_promo_message executed for 842 users</p>
          </div>
        </section>

        <div className="text-center pt-4">
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">
            Patio Curauma • Admin System v1.0.4
          </p>
        </div>
      </div>
    </main>
  );
}
