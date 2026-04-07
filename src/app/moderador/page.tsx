
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, Settings, UserCog, Database, 
  ArrowLeft, Search, MoreVertical, Store,
  AlertTriangle, Lock, Unlock, Loader2,
  UserPlus, UserMinus, RefreshCcw, FlaskConical,
  Navigation, Sparkles, Gift, Ban, UserCheck, 
  Edit3, Trash2, ShieldCheck, Eye, Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  onSnapshot, 
  orderBy, 
  limit,
  serverTimestamp,
  deleteDoc,
  increment
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { procesarProximidadGeofence, verificarYGenerarRecordatorioIA } from "@/lib/notificaciones";
import { registrarCompra } from "@/lib/puntos";
import { cn } from "@/lib/utils";

export default function ModeradorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [entrepreneurs, setEntrepreneurs] = useState<any[]>([]);
  const [recentTrans, setRecentTrans] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Listener de Emprendedores
    const q = query(collection(db, "usuarios"), where("rol", "==", "emprendedor"));
    const unsubscribeEmp = onSnapshot(q, (snapshot) => {
      setEntrepreneurs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listener de Transacciones para Radar de Fraude
    const transQ = query(collection(db, "system_logs"), orderBy("fecha", "desc"), limit(10));
    const unsubscribeTrans = onSnapshot(transQ, (snapshot) => {
      setRecentTrans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeEmp();
      unsubscribeTrans();
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;
    setLoading(true);
    try {
      const q = query(collection(db, "usuarios"), where("correo", "==", searchTerm.toLowerCase().trim()));
      const snap = await getDocs(q);
      setFoundUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (snap.empty) {
        toast({ title: "Sin resultados", description: "No se encontró ningún usuario." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Fallo en la búsqueda." });
    } finally {
      setLoading(false);
    }
  };

  const updateUserField = async (userId: string, field: string, value: any) => {
    try {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { 
        [field]: value,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Actualizado", description: `Campo ${field} modificado con éxito.` });
      setFoundUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar." });
    }
  };

  const handleFixStamps = async (userId: string, current: number) => {
    const newVal = prompt("Ingresa el número total de sellos:", current.toString());
    if (newVal !== null) {
      const num = parseInt(newVal);
      if (!isNaN(num)) updateUserField(userId, "comprasRealizadas", num);
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 pb-32 font-sans selection:bg-primary/30">
      {/* Header Estilo "Hilos Detrás de la Cortina" */}
      <div className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 p-6 sticky top-0 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-500 hover:text-white hover:bg-slate-800 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
                Master Control <ShieldCheck className="w-5 h-5 text-primary" />
              </h1>
              <p className="text-[10px] text-primary/80 font-bold uppercase tracking-[0.2em]">
                {auth.currentUser?.email}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-red-500/50 text-red-500 bg-red-500/5 font-black text-[9px] animate-pulse">
            LIVE DB ACCESS
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        
        {/* RADAR DE FRAUDE */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Radar de Anomalías</h2>
          </div>
          <Card className="bg-slate-900/50 border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
            <CardContent className="p-0">
              <div className="p-4 bg-amber-500/10 border-b border-slate-800 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <p className="text-[11px] font-bold text-amber-200/80">Monitoreando transacciones sospechosas...</p>
              </div>
              <div className="divide-y divide-slate-800/50">
                {recentTrans.length > 0 ? (
                  recentTrans.map((log, i) => (
                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-slate-300">
                          <span className="text-primary font-bold">{log.usuario}</span> {log.accion}
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono">
                          {new Date(log.fecha).toLocaleTimeString()} • ID: {log.id.slice(0,8)}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-slate-950 border-slate-700 text-[8px] font-bold">LOG_OK</Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-600 text-[10px] italic">No hay actividad reciente.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* BUSCADOR DE MIEMBROS */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Gestión de Cuentas</h2>
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <Input 
              placeholder="Buscar por correo exacto..." 
              className="bg-slate-900 border-slate-800 rounded-2xl pl-11 h-14 text-white focus:ring-primary focus:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              type="submit" 
              disabled={loading}
              className="absolute right-2 top-2 h-10 rounded-xl px-4 font-bold bg-primary hover:bg-primary/90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rastrear"}
            </Button>
          </form>

          <div className="space-y-3">
            {foundUsers.map(user => (
              <Card key={user.id} className={cn(
                "bg-slate-900 border-slate-800 rounded-[2rem] overflow-hidden shadow-xl transition-all",
                user.baneado && "opacity-60 border-red-900/50 grayscale-[0.5]"
              )}>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black",
                        user.baneado ? "bg-red-900/50" : "bg-slate-800"
                      )}>
                        {user.nombre?.[0] || user.correo?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-white">{user.nombre || "Socio Anónimo"}</p>
                          {user.baneado && <Badge className="bg-red-600 text-[8px] font-black uppercase">Baneado</Badge>}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold">{user.correo}</p>
                      </div>
                    </div>
                    <Badge className={cn(
                      "rounded-lg font-black text-[9px] uppercase tracking-tighter",
                      user.rol === 'admin' ? "bg-red-500" : user.rol === 'emprendedor' ? "bg-primary" : "bg-slate-700"
                    )}>
                      {user.rol}
                    </Badge>
                  </div>

                  {/* Acciones de Moderación */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => handleFixStamps(user.id, user.comprasRealizadas || 0)}
                      variant="outline" 
                      className="bg-slate-950 border-slate-800 text-[10px] h-10 gap-2 font-bold rounded-xl"
                    >
                      <Edit3 className="w-3 h-3 text-blue-400" /> Editar Sellos ({user.comprasRealizadas || 0})
                    </Button>
                    
                    {user.rol !== 'emprendedor' ? (
                      <Button 
                        onClick={() => updateUserField(user.id, 'rol', 'emprendedor')}
                        className="bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white text-[10px] h-10 gap-2 font-bold rounded-xl"
                      >
                        <UserPlus className="w-3 h-3" /> Hacer Aliado
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => updateUserField(user.id, 'rol', 'cliente')}
                        className="bg-slate-950 border-slate-800 text-slate-400 hover:text-white text-[10px] h-10 gap-2 font-bold rounded-xl"
                      >
                        <UserMinus className="w-3 h-3" /> Hacer Socio
                      </Button>
                    )}

                    <Button 
                      onClick={() => updateUserField(user.id, 'baneado', !user.baneado)}
                      variant="outline" 
                      className={cn(
                        "col-span-2 h-10 gap-2 font-bold rounded-xl text-[10px]",
                        user.baneado 
                          ? "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white" 
                          : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                      )}
                    >
                      {user.baneado ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                      {user.baneado ? "Desbloquear Usuario" : "Banear Usuario del Club"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ZONA DE LABORATORIO */}
        <section className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/20 space-y-4 shadow-xl">
          <div className="flex items-center gap-3 text-primary mb-2">
            <FlaskConical className="w-6 h-6" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Laboratorio de Pruebas</h2>
          </div>
          <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-4">
            Simula comportamientos de hardware y lógica de IA sin salir del panel.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <Button onClick={() => procesarProximidadGeofence(auth.currentUser?.uid!, "Admin", 0, true)} variant="outline" className="bg-slate-950 border-slate-800 h-14 gap-4 font-bold justify-start px-6 rounded-2xl group">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px]">Simular Geofence</p>
                <p className="text-[8px] text-slate-600">Alerta por proximidad</p>
              </div>
            </Button>
            
            <Button onClick={() => verificarYGenerarRecordatorioIA(auth.currentUser?.uid!, "Admin", 5)} variant="outline" className="bg-slate-950 border-slate-800 h-14 gap-4 font-bold justify-start px-6 rounded-2xl group">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px]">Forzar Mensaje IA</p>
                <p className="text-[8px] text-slate-600">Generar notificación Genkit</p>
              </div>
            </Button>

            <Button onClick={() => registrarCompra(db, auth.currentUser?.uid!)} variant="outline" className="bg-slate-950 border-slate-800 h-14 gap-4 font-bold justify-start px-6 rounded-2xl group">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                <Gift className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px]">Auto-Sello</p>
                <p className="text-[8px] text-slate-600">Sumar sello a mi cuenta</p>
              </div>
            </Button>
          </div>
        </section>

        <div className="text-center pt-8">
          <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.4em] bg-slate-950 py-3 rounded-full inline-block px-10 border border-slate-900">
            Patio Curauma • Master Admin v2.0
          </p>
        </div>
      </div>
    </main>
  );
}
