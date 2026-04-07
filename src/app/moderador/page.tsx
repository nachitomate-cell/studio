
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
  Edit3, ShieldCheck, Zap, Target, User
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
        const q = query(
          collection(db, "usuarios"), 
          where("correo", "==", TEST_TARGET_EMAIL.toLowerCase().trim())
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();
          setTestUser({
            id: d.id,
            nombre: data.nombre || "Socio de Prueba",
            sellos: data.comprasRealizadas || 0
          });
        } else {
          setTestUser(null);
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
        toast({ title: "Sin resultados", description: "No se encontró ningún usuario con ese correo." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Fallo en la búsqueda de base de datos." });
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
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el registro." });
    }
  };

  // HANDLERS DEL LABORATORIO (DIRIGIDOS A NACHITOMATE@GMAIL.COM)
  const runGeofenceTest = async () => {
    if (!testUser) {
      toast({ variant: "destructive", title: "Error", description: `No se encontró al usuario ${TEST_TARGET_EMAIL}.` });
      return;
    }
    setLoading(true);
    await procesarProximidadGeofence(testUser.id, testUser.nombre, testUser.sellos, true, true);
    setLoading(false);
    toast({ title: "Simulación Geofence", description: `Alerta enviada a ${TEST_TARGET_EMAIL}` });
  };

  const runAITest = async () => {
    if (!testUser) {
      toast({ variant: "destructive", title: "Error", description: `No se encontró al usuario ${TEST_TARGET_EMAIL}.` });
      return;
    }
    setLoading(true);
    await verificarYGenerarRecordatorioIA(testUser.id, testUser.nombre, testUser.sellos, true);
    setLoading(false);
    toast({ title: "Generación IA", description: `Mensaje persuasivo enviado a ${TEST_TARGET_EMAIL}` });
  };

  const runAutoStampTest = async () => {
    if (!testUser) {
      toast({ variant: "destructive", title: "Error", description: `No se encontró al usuario ${TEST_TARGET_EMAIL}.` });
      return;
    }
    setLoading(true);
    await registrarCompra(db, testUser.id, "TEST_LAB_ADMIN");
    setLoading(false);
    toast({ title: "Auto-Sello Lab", description: `Sello sumado exitosamente a ${TEST_TARGET_EMAIL}` });
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 pb-32 font-sans selection:bg-primary/30">
      {/* HEADER DE CONTROL */}
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
        
        {/* LABORATORIO DE PRUEBAS */}
        <section className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/20 space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target className="w-16 h-16 text-primary" />
          </div>
          
          <div className="flex items-center gap-3 text-primary mb-2">
            <FlaskConical className="w-6 h-6" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Zona de Pruebas</h2>
          </div>
          
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Target de Pruebas:</p>
              <p className="text-xs font-black text-white">{TEST_TARGET_EMAIL}</p>
              {isSearchingTestUser ? (
                <p className="text-[8px] text-slate-500 animate-pulse">Buscando...</p>
              ) : testUser ? (
                <p className="text-[8px] text-primary font-bold uppercase">Conectado (Sellos: {testUser.sellos})</p>
              ) : (
                <p className="text-[8px] text-red-500 font-bold uppercase">No registrado</p>
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
                <p className="text-[11px]">Simular Geofence</p>
                <p className="text-[8px] text-slate-600 uppercase">Proximidad forzada</p>
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
                <p className="text-[11px]">Forzar Mensaje IA</p>
                <p className="text-[8px] text-slate-600 uppercase">Generar mensaje Genkit</p>
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
                <p className="text-[8px] text-slate-600 uppercase">Sumar sello a nachitomate</p>
              </div>
            </Button>
          </div>
        </section>

        {/* GESTIÓN DE USUARIOS Y ROLES */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <UserCog className="w-4 h-4 text-slate-400" />
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gestión de Usuarios</h2>
          </div>
          
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input 
                placeholder="Email del usuario..." 
                className="pl-10 bg-slate-900 border-slate-800 rounded-xl h-12 text-sm focus:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="rounded-xl h-12 px-6 font-bold bg-primary text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
            </Button>
          </form>

          <div className="space-y-3">
            {foundUsers.map((user) => (
              <Card key={user.id} className="bg-slate-900/50 border-slate-800 rounded-2xl overflow-hidden shadow-lg border">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 border border-slate-700">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{user.nombre || "Sin nombre"}</p>
                        <p className="text-[10px] text-slate-500">{user.correo}</p>
                      </div>
                    </div>
                    <Badge variant={user.rol === 'admin' ? 'destructive' : user.rol === 'emprendedor' ? 'default' : 'outline'} className="text-[8px] uppercase font-black">
                      {user.rol || 'cliente'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-800">
                    <div className="space-y-2">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Asignar Rol</p>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant={user.rol === 'cliente' ? 'default' : 'outline'} 
                          className="flex-1 h-8 text-[9px] font-bold rounded-lg"
                          onClick={() => updateUserField(user.id, 'rol', 'cliente')}
                        >Socio Club</Button>
                        <Button 
                          size="sm" 
                          variant={user.rol === 'emprendedor' ? 'default' : 'outline'} 
                          className="flex-1 h-8 text-[9px] font-bold rounded-lg"
                          onClick={() => updateUserField(user.id, 'rol', 'emprendedor')}
                        >Aliado</Button>
                        <Button 
                          size="sm" 
                          variant={user.rol === 'admin' ? 'default' : 'outline'} 
                          className="flex-1 h-8 text-[9px] font-bold rounded-lg"
                          onClick={() => updateUserField(user.id, 'rol', 'admin')}
                        >Admin</Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                      <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase">Estado de Cuenta</p>
                        <p className={cn("text-[10px] font-bold", user.baneado ? "text-red-500" : "text-primary")}>
                          {user.baneado ? "SANCIONADO" : "ACTIVO"}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className={cn("h-8 px-4 rounded-lg text-[9px] font-bold gap-2", user.baneado ? "text-primary hover:bg-primary/10" : "text-red-500 hover:bg-red-500/10")}
                        onClick={() => updateUserField(user.id, 'baneado', !user.baneado)}
                      >
                        {user.baneado ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                        {user.baneado ? "REHABILITAR" : "BANEAR USUARIO"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* RADAR DE ANOMALÍAS (LOGS) */}
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
                        <p className="text-[9px] text-slate-500 font-mono uppercase">
                          {new Date(log.fecha).toLocaleTimeString()} • ID: {log.id.slice(0,8)}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-slate-950 border-slate-700 text-[8px] font-bold">LOG_OK</Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-600 text-[10px] italic">No hay actividad reciente en la red.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
