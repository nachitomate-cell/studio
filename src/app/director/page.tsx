
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
  onSnapshot, orderBy, limit, getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const COLORS = ['#D3B673', '#9DCC65', '#6EBBD1', '#BFA05C'];

export default function DirectorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);
  const [premios, setPremios] = useState<any[]>([]);
  const [mensajeGlobal, setMensajeGlobal] = useState({ titulo: "", cuerpo: "" });

  const [isPremioModalOpen, setIsPremioModalOpen] = useState(false);
  const [premioForm, setPremioForm] = useState<{ id: string | null; nombre: string; sellos_requeridos: number; icono: string; esSorteo: boolean }>({ id: null, nombre: '', sellos_requeridos: 5, icono: 'Gift', esSorteo: false });

  const [chartData, setChartData] = useState([
    { name: 'Sem 1', sellos: 0 },
    { name: 'Sem 2', sellos: 0 },
    { name: 'Sem 3', sellos: 0 },
    { name: 'Sem 4', sellos: 0 },
  ]);
  const [mesLabel, setMesLabel] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com")) {
          setIsAuthorized(true);
        } else {
          try {
             const userDoc = await getDoc(doc(db, "usuarios", user.uid));
             const userData = userDoc.data();
             if (userDoc.exists() && (userData?.rol === "director_patio" || userData?.rol === "director")) {
                setIsAuthorized(true);
             } else {
                toast({ variant: "destructive", title: "Acceso Denegado", description: "No cuentas con privilegios para ver este panel." });
                router.replace("/");
             }
          } catch (e) {
             router.replace("/");
          }
        }
      } else {
        router.replace("/");
      }
    });

    return () => unsubAuth();
  }, [router, toast]);

  useEffect(() => {
    if (!isAuthorized) return;

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // Label dinámico del mes actual
    setMesLabel(
      now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).toUpperCase()
    );

    // Semanas del mes para el gráfico
    const SEMANAS = [
      { name: 'Sem 1', start: 1, end: 7 },
      { name: 'Sem 2', start: 8, end: 14 },
      { name: 'Sem 3', start: 15, end: 21 },
      { name: 'Sem 4', start: 22, end: 31 },
    ];

    // Listener en tiempo real a system_logs desde el inicio del mes
    const logsQ = query(
      collection(db, "system_logs"),
      where("fecha", ">=", inicioMes.toISOString())
    );

    const unsubLogs = onSnapshot(logsQ, async (logsSnap) => {
      // Solo sellos confirmados por handshake
      const handshakeLogs = logsSnap.docs
        .map(d => d.data())
        .filter(d => d.tipo === "FIDELIZACION");

      // ── Gráfico semanal ──────────────────────────────────────────────
      setChartData(
        SEMANAS.map(sem => ({
          name: sem.name,
          sellos: handshakeLogs.filter(log => {
            const day = new Date(log.fecha).getDate();
            return day >= sem.start && day <= sem.end;
          }).length
        }))
      );

      // ── Ranking por vendedor ─────────────────────────────────────────
      const countByVendor: Record<string, number> = {};
      handshakeLogs.forEach(log => {
        if (log.vendedorId) {
          countByVendor[log.vendedorId] = (countByVendor[log.vendedorId] || 0) + 1;
        }
      });

      // Obtener nombres de los emprendedores
      try {
        const empSnap = await getDocs(
          query(collection(db, "usuarios"), where("rol", "==", "emprendedor"))
        );
        const rankingData = empSnap.docs
          .map(d => {
            const data = d.data() as any;
            return {
              id: d.id,
              nombreTienda: data.nombreTienda || data.nombre || "Local Aliado",
              rubro: data.rubro || "General",
              sellosEntregados: countByVendor[d.id] || 0
            };
          })
          .sort((a, b) => b.sellosEntregados - a.sellosEntregados);
        setRanking(rankingData);
      } catch {
        // Si falla la lectura de usuarios, mostrar solo los que tienen logs
        const fallback = Object.entries(countByVendor)
          .map(([id, count]) => ({ id, nombreTienda: id.substring(0, 8), rubro: "General", sellosEntregados: count }))
          .sort((a, b) => b.sellosEntregados - a.sellosEntregados);
        setRanking(fallback);
      }
    });

    // Escuchar premios en tiempo real
    const unsubPremios = onSnapshot(collection(db, "config_premios"), (snap) => {
      setPremios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubLogs();
      unsubPremios();
    };
  }, [isAuthorized]);

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

  const handleOpenPremioModal = (premio?: any) => {
    if (premio) {
      setPremioForm({ 
        id: premio.id, 
        nombre: premio.nombre || '', 
        sellos_requeridos: premio.sellos_requeridos || premio.costo || 5, 
        icono: premio.icono || 'Gift',
        esSorteo: premio.esSorteo || false
      });
    } else {
      setPremioForm({ id: null, nombre: '', sellos_requeridos: 5, icono: 'Gift', esSorteo: false });
    }
    setIsPremioModalOpen(true);
  };

  const handleSavePremio = async () => {
    if (!premioForm.nombre || !premioForm.sellos_requeridos) return;
    setLoading(true);
    try {
      if (premioForm.id) {
        await updateDoc(doc(db, "config_premios", premioForm.id), {
          nombre: premioForm.nombre,
          sellos_requeridos: Number(premioForm.sellos_requeridos),
          icono: premioForm.icono,
          esSorteo: premioForm.esSorteo
        });
        toast({ title: "Premio Actualizado" });
      } else {
        await addDoc(collection(db, "config_premios"), {
          nombre: premioForm.nombre,
          sellos_requeridos: Number(premioForm.sellos_requeridos),
          icono: premioForm.icono,
          esSorteo: premioForm.esSorteo,
          fechaCreacion: new Date().toISOString(),
          activo: true
        });
        toast({ title: "Premio Creado" });
      }
      setIsPremioModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se guardaron los cambios." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePremio = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este premio?")) {
      await deleteDoc(doc(db, "config_premios", id));
      toast({ title: "Premio Eliminado" });
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
         <p className="text-sm font-bold text-slate-500 animate-pulse">Verificando credenciales...</p>
      </div>
    );
  }

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
            <Badge className="bg-primary/10 text-primary border-none text-[9px]">{mesLabel}</Badge>
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
            <Button onClick={() => handleOpenPremioModal()} size="sm" variant="ghost" className="text-primary font-bold h-8 gap-1">
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
                        {premio.esSorteo ? <Ticket className="w-5 h-5 text-yellow-600" /> : <Trophy className="w-5 h-5 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{premio.nombre}</p>
                        <p className="text-[10px] text-primary font-black uppercase">{premio.sellos_requeridos || premio.costo || 0} Sellos</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <Button onClick={() => handleOpenPremioModal(premio)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-primary"><Edit3 className="w-4 h-4" /></Button>
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

      {/* MODAL CONFIGURACION DE PREMIOS */}
      {isPremioModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-300">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-black text-slate-800">
                {premioForm.id ? "Editar Recompensa" : "Nueva Recompensa"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Nombre del Beneficio</label>
                <Input 
                   value={premioForm.nombre}
                   onChange={e => setPremioForm({...premioForm, nombre: e.target.value})}
                   placeholder="Ej: Taza de Murú..."
                   className="h-12 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Requisito (Sellos)</label>
                  <Input 
                     type="number"
                     value={premioForm.sellos_requeridos}
                     onChange={e => setPremioForm({...premioForm, sellos_requeridos: parseInt(e.target.value) || 0})}
                     className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Ícono Visual</label>
                  <select 
                     value={premioForm.icono}
                     onChange={e => setPremioForm({...premioForm, icono: e.target.value})}
                     className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                     <option value="Gift">Regalo Genérico</option>
                     <option value="Coffee">Taza de Café</option>
                     <option value="Pizza">Comida Rest.</option>
                     <option value="Star">Estrella</option>
                     <option value="Sparkles">Destellos Mag.</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                <input 
                  type="checkbox" 
                  id="esSorteo" 
                  checked={premioForm.esSorteo}
                  onChange={e => setPremioForm({...premioForm, esSorteo: e.target.checked})}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="esSorteo" className="text-xs font-bold text-slate-600">
                  Es un Sorteo Especial (Ticket)
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsPremioModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
                <Button onClick={handleSavePremio} disabled={loading} className="flex-1 h-12 rounded-xl font-bold bg-primary text-white hover:bg-primary/90">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
