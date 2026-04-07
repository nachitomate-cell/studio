
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, Settings, UserCog, Database, 
  ArrowLeft, Search, MoreVertical, Store,
  AlertTriangle, Lock, Unlock, Loader2,
  UserPlus, UserMinus, RefreshCcw
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
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function ModeradorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [entrepreneurs, setEntrepreneurs] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);

  // Cargar Emprendedores en Tiempo Real
  useEffect(() => {
    const q = query(collection(db, "usuarios"), where("rol", "==", "emprendedor"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntrepreneurs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      const permissionError = new FirestorePermissionError({
        path: 'usuarios',
        operation: 'list',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });

    // Cargar Logs (Simulados por ahora o desde colección si existe)
    const logsQ = query(collection(db, "system_logs"), orderBy("fecha", "desc"), limit(5));
    const unsubscribeLogs = onSnapshot(logsQ, (snapshot) => {
      setSystemLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeLogs();
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;
    setLoading(true);
    try {
      // Búsqueda por correo (exacta)
      const q = query(collection(db, "usuarios"), where("correo", "==", searchTerm.toLowerCase().trim()));
      const snap = await getDocs(q);
      setFoundUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (snap.empty) {
        toast({ title: "Sin resultados", description: "No se encontró ningún usuario con ese correo." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error de búsqueda", description: "Verifica tu conexión." });
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      const userRef = doc(db, "usuarios", userId);
      updateDoc(userRef, { 
        rol: newRole,
        updatedAt: new Date().toISOString()
      }).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: { rol: newRole },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });

      toast({ title: "Rol Actualizado", description: `El usuario ahora es ${newRole}.` });
      // Refrescar búsqueda local si es necesario
      setFoundUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el rol." });
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-100 pb-20 font-sans">
      {/* Header Master */}
      <div className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 sticky top-0 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Master Admin</h1>
              <p className="text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Soporte Master Activo
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary">
              <RefreshCcw className="w-4 h-4" />
            </Button>
            <Settings className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        {/* Banner de Peligro */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 flex gap-4">
          <div className="w-10 h-10 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-xs text-red-200 leading-relaxed font-medium">
            <span className="font-black text-red-500 uppercase block mb-1 text-[10px]">Acceso Crítico</span>
            Estás operando sobre la base de datos de producción. Los cambios en roles y estados son instantáneos para los usuarios.
          </p>
        </div>

        {/* Buscador de Usuarios del Sistema */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Gestión de Usuarios</h2>
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Email del socio (ej: jdoe@gmail.com)" 
              className="bg-slate-800/50 border-slate-700 rounded-2xl pl-11 h-14 text-slate-200 focus:ring-primary focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button 
              type="submit" 
              disabled={loading}
              className="absolute right-2 top-2 h-10 rounded-xl px-4 font-bold bg-primary hover:bg-primary/90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
            </Button>
          </form>

          {/* Resultados de Búsqueda */}
          {foundUsers.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
              {foundUsers.map(user => (
                <Card key={user.id} className="bg-slate-800 border-slate-700 rounded-3xl overflow-hidden shadow-xl">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{user.nombre || "Socio Sin Nombre"}</p>
                        <p className="text-xs text-slate-500">{user.correo}</p>
                      </div>
                      <Badge className={user.rol === 'emprendedor' ? 'bg-primary' : 'bg-slate-600'}>
                        {user.rol?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {user.rol !== 'emprendedor' ? (
                        <Button 
                          onClick={() => changeRole(user.id, 'emprendedor')}
                          className="flex-1 rounded-xl bg-primary/20 text-primary hover:bg-primary hover:text-white font-bold h-10 text-xs gap-2"
                        >
                          <UserPlus className="w-4 h-4" /> Promover a Aliado
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => changeRole(user.id, 'cliente')}
                          variant="outline"
                          className="flex-1 rounded-xl border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-bold h-10 text-xs gap-2"
                        >
                          <UserMinus className="w-4 h-4" /> Degradación a Socio
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Control de Aliados (Emprendedores) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aliados Activos</h2>
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">{entrepreneurs.length} Locales</Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {entrepreneurs.map((emp) => (
              <div key={emp.id} className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-3xl flex items-center justify-between group hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-700/50 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{emp.nombreTienda || emp.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">{emp.rubro || "Sin Rubro"}</span>
                      <div className="w-1 h-1 bg-slate-600 rounded-full" />
                      <span className="text-[10px] text-primary font-black">{emp.comprasRealizadas || 0} Sellos</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white"><Unlock className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white"><MoreVertical className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
            {entrepreneurs.length === 0 && (
              <div className="text-center py-10 bg-slate-800/20 rounded-3xl border border-dashed border-slate-800">
                <p className="text-xs text-slate-500 italic">No hay emprendedores registrados en la DB.</p>
              </div>
            )}
          </div>
        </section>

        {/* Logs de Sistema en Vivo */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Database className="w-4 h-4 text-blue-500" />
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logs de Transacciones</h2>
          </div>
          <div className="bg-slate-950 rounded-[2rem] p-6 font-mono text-[10px] text-green-500/90 space-y-2 border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500/20 to-transparent animate-pulse" />
            {systemLogs.length > 0 ? (
              systemLogs.map(log => (
                <p key={log.id} className="leading-relaxed">
                  <span className="text-slate-600">[{new Date(log.fecha).toLocaleTimeString()}]</span> {log.accion} - <span className="text-blue-400">{log.usuario}</span>
                </p>
              ))
            ) : (
              <>
                <p className="leading-relaxed animate-in fade-in duration-500"><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> MASTER_AUTH: Success - Access granted to dev mode</p>
                <p className="leading-relaxed opacity-80"><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> DB_QUERY: Reading collection 'usuarios' (Filter: role=entrepreneur)</p>
                <p className="leading-relaxed text-blue-400 opacity-60"><span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> SYSTEM: Geofencing active for 842 devices</p>
              </>
            )}
            <div className="flex items-center gap-2 pt-2 text-[8px] text-slate-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Sincronizando con Firestore Live...
            </div>
          </div>
        </section>

        <div className="text-center pt-8">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em] bg-slate-900/50 py-3 rounded-full inline-block px-8 border border-slate-800">
            Patio Curauma • Admin OS v1.2.0
          </p>
        </div>
      </div>
    </main>
  );
}
