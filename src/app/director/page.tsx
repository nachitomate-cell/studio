
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, Users, Ticket, TrendingUp, 
  ArrowLeft, Download, Send, Plus, Trash2, 
  Edit3, Trophy, Megaphone, Loader2, Store
} from "lucide-react";
import { useRouter } from "next/navigation";
import { 
  collection, query, where, getDocs, 
  addDoc, deleteDoc, doc, updateDoc, 
  onSnapshot, orderBy, limit 
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const COLORS = ['#8dc63f', '#7fb339', '#71a033', '#638d2d'];

export default function DirectorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);
  const [premios, setPremios] = useState<any[]>([]);
  const [mensajeGlobal, setMensajeGlobal] = useState({ titulo: "", cuerpo: "" });

  // Datos para el gráfico de barras (simulados para el dashboard)
  const [chartData, setChartData] = useState([
    { name: 'Sem 1', sellos: 450 },
    { name: 'Sem 2', sellos: 520 },
    { name: 'Sem 3', sellos: 380 },
    { name: 'Sem 4', sellos: 610 },
  ]);

  useEffect(() => {
    // 1. Cargar Ranking de Emprendedores (Simulamos por actividad de ventas registradas)
    const fetchRanking = async () => {
      const q = query(collection(db, "usuarios"), where("rol", "==", "emprendedor"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRanking(data.sort((a, b) => (b.sellosEntregados || 0) - (a.sellosEntregados || 0)));
    };

    // 2. Escuchar Premios en Tiempo Real
    const unsubscribePremios = onSnapshot(collection(db, "config_premios"), (snap) => {
      setPremios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    fetchRanking();
    return () => unsubscribePremios();
  }, []);

  const handleSendGlobalMessage = async () => {
    if (!mensajeGlobal.titulo || !mensajeGlobal.cuerpo) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "Escribe un título y un mensaje." });
      return;
    }
    setLoading(true);
    try {
      // Obtenemos todos los usuarios para enviarles la notificación
      const usersSnap = await getDocs(collection(db, "usuarios"));
      const batchPromises = usersSnap.docs.map(userDoc => {
        const notifRef = collection(db, "usuarios", userDoc.id, "notificaciones");
        return addDoc(notifRef, {
          titulo: `📢 ${mensajeGlobal.titulo}`,
          mensaje: mensajeGlobal.cuerpo,
          fecha: new Date().toISOString(),
          tipo: "BROADCAST",
          leida: false
        });
      });

      await Promise.all(batchPromises);
      
      toast({ title: "¡Mensaje Enviado!", description: `Se ha notificado a ${usersSnap.size} socios del club.` });
      setMensajeGlobal({ titulo: "", cuerpo: "" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar el envío masivo." });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPremio = async () => {
    const nombre = prompt("Nombre del premio:");
    const costo = prompt("Costo en sellos:");
    if (nombre && costo) {
      await addDoc(collection(db, "config_premios"), {
        nombre,
        costo: parseInt(costo),
        fechaCreacion: new Date().toISOString(),
        activo: true
      });
      toast({ title: "Premio Creado", description: "El nuevo beneficio ya está disponible." });
    }
  };

  const handleDeletePremio = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este premio?")) {
      await deleteDoc(doc(db, "config_premios", id));
      toast({ title: "Premio Eliminado" });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/50 pb-32">
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Panel Directivo</h1>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl gap-2 font-bold text-[10px] uppercase">
            <Download className="w-3 h-3" /> Reporte Mes
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        
        {/* RANKING DE EMPRENDEDORES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" /> Ranking de Locales
            </h2>
            <Badge className="bg-primary/10 text-primary border-none text-[9px]">MARZO 2024</Badge>
          </div>
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <CardContent className="p-2">
              {ranking.length > 0 ? (
                ranking.slice(0, 3).map((emp, i) => (
                  <div key={emp.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{emp.nombreTienda || emp.nombre || "Local Aliado"}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black">{emp.rubro || "General"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-primary">{emp.sellosEntregados || 0}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Sellos Mes</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 italic">No hay datos de actividad aún.</div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* COMUNICADO GLOBAL (PUSH) */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Comunicado Global
          </h2>
          <Card className="border-none shadow-xl bg-primary text-white rounded-[2rem] overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Input 
                  placeholder="Título del anuncio..." 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
                  value={mensajeGlobal.titulo}
                  onChange={(e) => setMensajeGlobal({...mensajeGlobal, titulo: e.target.value})}
                />
                <Textarea 
                  placeholder="Escribe el mensaje para todos los socios..." 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl min-h-[80px]"
                  value={mensajeGlobal.cuerpo}
                  onChange={(e) => setMensajeGlobal({...mensajeGlobal, cuerpo: e.target.value})}
                />
              </div>
              <Button 
                onClick={handleSendGlobalMessage}
                disabled={loading}
                className="w-full bg-white text-primary hover:bg-white/90 font-black rounded-xl h-12 gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Notificación Push
              </Button>
              <p className="text-[9px] text-center text-white/60 font-medium">Este mensaje llegará a todos los dispositivos con el Club instalado.</p>
            </CardContent>
          </Card>
        </section>

        {/* GESTOR DE PREMIOS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Gestión de Premios</h2>
            <Button onClick={handleAddPremio} size="sm" variant="ghost" className="text-primary font-bold h-8 gap-1">
              <Plus className="w-4 h-4" /> Nuevo
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {premios.length > 0 ? (
              premios.map(premio => (
                <Card key={premio.id} className="border-none shadow-sm bg-white rounded-2xl">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary">
                        <Ticket className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{premio.nombre}</p>
                        <p className="text-[10px] text-primary font-black uppercase">{premio.costo} Sellos</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-primary"><Edit3 className="w-4 h-4" /></Button>
                      <Button onClick={() => handleDeletePremio(premio.id)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 italic">No hay premios configurados en la nube.</div>
            )}
          </div>
        </section>

        {/* GRÁFICO DE SALUD DEL PATIO */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black text-slate-400 uppercase flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Salud del Recinto
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
