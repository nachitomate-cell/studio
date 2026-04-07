
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, Settings, UserCog, Database, 
  ArrowLeft, Search, Store, AlertTriangle, 
  Loader2, UserPlus, UserMinus, FlaskConical,
  Navigation, Sparkles, Gift, Ban, UserCheck, 
  Edit3, ShieldCheck, Zap, Target
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
  limit
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { procesarProximidadGeofence, verificarYGenerarRecordatorioIA } from "@/lib/notificaciones";
import { registrarCompra } from "@/lib/puntos";
import { cn } from "@/lib/utils";

const TEST_TARGET_EMAIL = 'nachitomate@gmail.com';

export default function ModeradorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [recentTrans, setRecentTrans] = useState<any[]>([]);
  
  // Estado para el usuario de prueba nachitomate@gmail.com
  const [testUser, setTestUser] = useState<{id: string, nombre: string, sellos: number} | null>(null);
  const [isSearchingTestUser, setIsSearchingTestUser] = useState(true);

  useEffect(() => {
    // 1. Buscar al usuario de prueba nachitomate@gmail.com para el laboratorio
    const fetchTestUser = async () => {
      setIsSearchingTestUser(true);
      try {
        const q = query(collection(db, "usuarios"), where("correo", "==", TEST_TARGET_EMAIL));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();
          setTestUser({
            id: d.id,
            nombre: data.nombre || "Socio de Prueba",
            sellos: data.comprasRealizadas || 0
          });
        }
      } catch (e) {
        console.error("Error buscando usuario de prueba:", e);
      } finally {
        setIsSearchingTestUser(false);
      }
    };

    fetchTestUser();

    // 2. Listener de Transacciones para Radar de Fraude
    const transQ = query(collection(db, "system_logs"), orderBy("fecha", "desc"), limit(10));
    const unsubscribeTrans = onSnapshot(transQ, (snapshot) => {
      setRecentTrans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
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

  // HANDLERS DEL LABORATORIO (DIRIGIDOS A NACHITOMATE@GMAIL.COM)
  const runGeofenceTest = async () => {
    if (!testUser) {
      toast({ variant: "destructive", title: "Error", description: `No se encontró al usuario ${TEST_TARGET_EMAIL}` });
      return;
    }
    setLoading(true);
    await procesarProximidadGeofence(testUser.id, testUser.nombre, testUser.sellos, true);
    setLoading(false);
    toast({ title: "Simulación Geofence", description: `Enviada a ${TEST_TARGET_EMAIL}` });
  };

  const runAITest = async () => {
    if (!testUser) {
      toast({ variant: "destructive", title: "Error", description: `No se encontró al usuario ${TEST_TARGET_EMAIL}` });
      return;
    }
    setLoading(true);
    await verificarYGenerarRecordatorioIA(testUser.id, testUser.nombre, testUser.sellos);
    setLoading(false);
    toast({ title: "Generación IA", description: `Mensaje Genkit enviado a ${TEST_TARGET_EMAIL}` });
  };

  const runAutoStampTest = async () => {
    if (!testUser) {
      toast({ variant: "destructive", title: "Error", description: `No se encontró al usuario ${TEST_TARGET_EMAIL}` });
      return;
    }
    setLoading(true);
    await registrarCompra(db, testUser.id, "TEST_LAB_ADMIN");
    setLoading(false);
    toast({ title: "Auto-Sello Lab", description: `Sello sumado a ${TEST_TARGET_EMAIL}` });
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
        
        {/* ZONA DE LABORATORIO - DIRIGIDA A NACHITOMATE@GMAIL.COM */}
        <section className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/20 space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target className="w-16 h-16 text-primary" />
          </div>
          
          <div className="flex items-center gap-3 text-primary mb-2">
            <FlaskConical className="w-6 h-6" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Laboratorio de Pruebas</h2>
          </div>
          
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Target de Pruebas:</p>
              <p className="text-xs font-black text-white">{TEST_TARGET_EMAIL}</p>
              {isSearchingTestUser ? (
                <p className="text-[8px] text-slate-500 animate-pulse">Buscando UID en Firebase...</p>
              ) : testUser ? (
                <p className="text-[8px] text-primary font-bold">USUARIO CONECTADO (UID: {testUser.id.slice(0,8)}...)</p>
              ) : (
                <p className="text-[8px] text-red-500 font-bold">ERROR: USUARIO NO REGISTRADO</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button 
              onClick={runGeofenceTest} 
              disabled={loading || !testUser}
              variant="outline" 
              className="bg-slate-950 border-slate-800 h-14 gap-4 font-bold justify-start px-6 rounded-2xl group transition-all hover:border-primary/50"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px]">Simular Geofence en nachitomate</p>
                <p className="text-[8px] text-slate-600">Alerta de proximidad remota</p>
              </div>
            </Button>
            
            <Button 
              onClick={runAITest} 
              disabled={loading || !testUser}
              variant="outline" 
              className="bg-slate-950 border-slate-800 h-14 gap-4 font-bold justify-start px-6 rounded-2xl group transition-all hover:border-primary/50"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px]">Forzar Mensaje IA en nachitomate</p>
                <p className="text-[8px] text-slate-600">Generar notificación Genkit remota</p>
              </div>
            </Button>

            <Button 
              onClick={runAutoStampTest} 
              disabled={loading || !testUser}
              variant="outline" 
              className="bg-slate-950 border-slate-800 h-14 gap-4 font-bold justify-start px-6 rounded-2xl group transition-all hover:border-primary/50"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                <Gift className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px]">Auto-Sello Remoto</p>
                <p className="text-[8px] text-slate-600">Sumar sello a nachitomate</p>
              </div>
            </Button>
          </div>
        </section>

        {/* RADAR DE FRAUDE */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Radar de Anomalías</h2>
          </div>
          <Card className="bg-slate-900/50 border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800/50">
                {recentTrans.length > 0 ? (
                  recentTrans.map((log) => (
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
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Buscador Global</h2>
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <Input 
              placeholder="Correo del usuario..." 
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
                  </div>

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
                      {user.baneado ? "Desbloquear Usuario" : "Banear Usuario"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="text-center pt-8">
          <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.4em] bg-slate-950 py-3 rounded-full inline-block px-10 border border-slate-900">
            Patio Curauma • Test Mode Active
          </p>
        </div>
      </div>
    </main>
  );
}
