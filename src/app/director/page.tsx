
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, Users, Ticket, TrendingUp, 
  ArrowLeft, Download, Calendar, PieChart
} from "lucide-react";
import { useRouter } from "next/navigation";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const DATA_VENTAS = [
  { name: 'Semana 1', sellos: 450 },
  { name: 'Semana 2', sellos: 520 },
  { name: 'Semana 3', sellos: 380 },
  { name: 'Semana 4', sellos: 610 },
];

const COLORS = ['#8dc63f', '#7fb339', '#71a033', '#638d2d'];

export default function DirectorPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20">
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">Panel Directivo</h1>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl gap-2 font-bold text-[10px] uppercase">
            <Download className="w-3 h-3" /> Reporte
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* KPIs Rápidos */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none shadow-sm bg-primary text-white rounded-2xl">
            <CardContent className="p-4 space-y-1">
              <p className="text-[10px] font-bold uppercase opacity-80">Total Sellos Mes</p>
              <p className="text-2xl font-black">1,960</p>
              <div className="flex items-center gap-1 text-[10px] font-bold">
                <TrendingUp className="w-3 h-3" /> +12% vs mes anterior
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white rounded-2xl">
            <CardContent className="p-4 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Socios Activos</p>
              <p className="text-2xl font-black text-slate-800">842</p>
              <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                <Users className="w-3 h-3" /> +45 nuevos hoy
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Actividad */}
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Actividad Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DATA_VENTAS}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px'}}
                />
                <Bar dataKey="sellos" radius={[6, 6, 0, 0]}>
                  {DATA_VENTAS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gestión Sorteos */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Gestión de Sorteos</h2>
          <Card className="border-none shadow-md bg-yellow-50 rounded-3xl border-2 border-yellow-200/50">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-white mx-auto shadow-lg shadow-yellow-200">
                <Ticket className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-yellow-800">Próximo Gran Sorteo</h3>
                <p className="text-xs text-yellow-700 font-medium">31 de Marzo • 18:00 hrs</p>
              </div>
              <div className="flex justify-center gap-4 py-2">
                <div>
                  <p className="text-xl font-black text-yellow-900">4,285</p>
                  <p className="text-[8px] font-bold text-yellow-700 uppercase">Tickets emitidos</p>
                </div>
                <div className="w-px h-8 bg-yellow-200 self-center" />
                <div>
                  <p className="text-xl font-black text-yellow-900">$500k</p>
                  <p className="text-[8px] font-bold text-yellow-700 uppercase">Pozo Estimado</p>
                </div>
              </div>
              <Button className="w-full rounded-2xl bg-yellow-500 hover:bg-yellow-600 font-bold">Lanzar Sorteo</Button>
            </CardContent>
          </Card>
        </section>

        {/* Alertas Globales */}
        <Card className="border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase">Mensajes del Patio</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <p className="text-xs font-bold">2 Locales cerrados hoy</p>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-primary">Ver</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
