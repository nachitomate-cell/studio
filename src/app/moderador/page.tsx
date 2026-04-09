"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, updateDoc, doc, onSnapshot, limit, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, AlertTriangle, Search, Target, FlaskConical, Navigation, Sparkles, Gift, Zap, ShieldCheck, UserCog } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Importaciones de utilidades previas
import { procesarProximidadGeofence, verificarYGenerarRecordatorioIA } from "@/lib/ai-actions";
import { registrarCompra } from "@/lib/puntos";
import { enviarNotificacionLocal } from "@/lib/notificaciones";

const MASTER_EMAIL = "ignaciiio.mate@gmail.com";
const TEST_TARGET_EMAIL = "nachitomate@gmail.com";

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  rol?: string;
}

export default function ModeradorPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Estados Generales
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Estados Tabla de Clientes
  const [loadingData, setLoadingData] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Estados Herramientas Restablecidas
  const [testUser, setTestUser] = useState<any>(null);
  const [isSearchingTestUser, setIsSearchingTestUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [recentTrans, setRecentTrans] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Estados Demo Celular
  const [showPhoneMockup, setShowPhoneMockup] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState({ type: '', title: '', text: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || user.email !== MASTER_EMAIL) {
        setAccessDenied(true);
        setLoadingConfig(false);
        setTimeout(() => {
          router.push("/");
        }, 3500);
        return;
      }

      setLoadingConfig(false);
      fetchClientes();
      fetchTestUser();
    });

    // Suscripción al Radar de Anomalías (Logs reales si existen en 'system_logs')
    const transQ = query(collection(db, "system_logs"), orderBy("fecha", "desc"), limit(5));
    const unsubscribeTrans = onSnapshot(transQ, (snapshot) => {
      setRecentTrans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.warn("Radar de anomalías no tiene permisos o colección vacía:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeTrans();
    };
  }, [router]);

  const fetchClientes = async () => {
    try {
      const q = query(collection(db, "usuarios"));
      const snapshot = await getDocs(q);
      const data: Cliente[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        let formattedDate = "N/A";
        
        if (d.fechaNacimiento) {
          if (typeof d.fechaNacimiento.toDate === "function") {
            formattedDate = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d.fechaNacimiento.toDate());
          } else if (typeof d.fechaNacimiento === "string") {
            try {
              const dt = new Date(d.fechaNacimiento);
              if (!isNaN(dt.getTime())) {
                formattedDate = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(dt);
              } else {
                 formattedDate = d.fechaNacimiento;
               }
            } catch (e) {
              formattedDate = d.fechaNacimiento;
            }
          }
        }

        return {
          id: doc.id,
          nombre: d.nombre || "Sin nombre",
          email: d.email || d.correo || "Sin correo",
          telefono: d.telefono || "Sin teléfono",
          fechaNacimiento: formattedDate,
          rol: d.rol || "cliente"
        };
      });
      
      data.sort((a, b) => a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase()));
      setClientes(data);
    } catch (error) {
      console.error("Error al obtener clientes:", error);
    } finally {
      setLoadingData(false);
    }
  };

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
        setTestUser({ id: d.id, nombre: data.nombre || "Socio de Prueba", sellos: data.comprasRealizadas || 0 });
      } else {
        setTestUser(null);
      }
    } catch (e) {
      console.error("Error buscando usuario de prueba:", e);
    } finally {
      setIsSearchingTestUser(false);
    }
  };

  // --- Handlers de Herramientas Restablecidas --- //

  const runGeofenceDemo = async () => {
    if (!testUser) return;
    setActionLoading(true);
    
    // Solicitamos permiso si no se tiene
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
       await Notification.requestPermission();
    }
    
    await new Promise(res => setTimeout(res, 1000)); // Simulador visual de red
    
    // Ejecución silente del evento real por detrás (opcional)
    try {
      await procesarProximidadGeofence(testUser.id, testUser.nombre, testUser.sellos, true, true);
    } catch(e) {}
    
    const title = "¡Estás cerca de Patio Curauma! 📍";
    const body = "Detectamos que estás a pocos metros. ¡Pasa por Murú Cosmética y suma tu sello del día! 🌿";

    // 1. Unificando Lógica: Usamos el mismo pipeline de subcolección que usan los sellos
    try {
      await enviarNotificacionLocal(testUser.id, title, body);
    } catch(e) { console.error("Error al disparar notificación real", e); }

    // Disparar Modal Interactivo tipo "Celular" de fondo para la demo de admin
    setPhoneMessage({
      type: 'Notificación Push Geofence',
      title: title,
      text: body
    });
    setShowPhoneMockup(true);
    setActionLoading(false);
  };

  const runAIDemo = async (tipo: string, mensaje: string) => {
    if (!testUser) return;
    setActionLoading(true);
    
    // Simular el tiempo de respuesta IA "escribiendo"
    await new Promise(res => setTimeout(res, 1500));
    
    const title = (tipo === 'Cumpleaños' ? '🎉 ' : tipo === 'Fidelización' ? '🔥 ' : '☕ ') + `Notificación: ${tipo}`;
    
    // 1. Unificando Lógica: Usamos el mismo pipeline de subcolección que usan los sellos
    try {
      await enviarNotificacionLocal(testUser.id, title, mensaje);
    } catch(e) { console.error("Error al disparar IA real", e); }
    
    toast({ title: `✨ Mensaje IA enviado: ${tipo}`, description: `El mensaje interactivo fue despachado a la base de datos de ${TEST_TARGET_EMAIL}.` });

    setPhoneMessage({
      type: 'Asistente IA Smart',
      title: title,
      text: mensaje
    });
    setShowPhoneMockup(true);
    setActionLoading(false);
  };

  const runAutoStampTest = async () => {
    if (!testUser) return;
    setActionLoading(true);
    try {
      await registrarCompra(db, testUser.id, "TEST_LAB_ADMIN");
      toast({ title: "Sello Sumado", description: `Se acreditó +1 sello automatizado a ${TEST_TARGET_EMAIL}` });
      fetchTestUser(); // Actualizar contador localmente
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Falló el otorgamiento de sello." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearchUserForRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) {
      setFoundUser(null);
      return;
    }
    setLoadingRole(true);
    try {
      const q = query(collection(db, "usuarios"), where("correo", "==", searchTerm.toLowerCase().trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setFoundUser({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setFoundUser(null);
        toast({ title: "Sin resultados", description: "Ese correo no existe en la base de datos.", variant: "destructive" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Fallo de comunicación con Firebase." });
    } finally {
      setLoadingRole(false);
    }
  };

  const updateUserRole = async (newRole: string) => {
    if (!foundUser) return;
    setActionLoading(true);
    try {
      const userRef = doc(db, "usuarios", foundUser.id);
      await updateDoc(userRef, { rol: newRole, updatedAt: new Date().toISOString() });
      setFoundUser({ ...foundUser, rol: newRole });
      toast({ title: "¡Rol Actualizado!", description: `El usuario ahora tiene el rol: ${newRole}` });
      fetchClientes(); // Refresh tabla principal silenciosamente en el fondo
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el rol." });
    } finally {
      setActionLoading(false);
    }
  };

  // --- Renderización Principal --- //

  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Verificando seguridad...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 animate-in fade-in duration-500">
        <Alert variant="destructive" className="max-w-md w-full border-red-500/50 bg-white shadow-xl shadow-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <AlertTitle className="text-xl font-black text-red-700 ml-2">Acceso Denegado</AlertTitle>
          <AlertDescription className="text-sm text-slate-600 mt-2 ml-2 leading-relaxed font-medium">
            No tienes los permisos de Master Admin necesarios para acceder a este panel de control de datos.
            <br/><br/>
            <span className="text-xs text-slate-400">Serás redirigido automáticamente a la página principal...</span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20 p-6 md:p-12 font-sans animate-in slide-in-from-bottom-8 duration-500">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Base de Datos de Clientes <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-primary hidden md:block" />
          </h1>
          <p className="text-slate-500 font-medium">Panel de administración global avanzado para Master Admin.</p>
        </div>

        {/* METRICAS (TARJETAS SUPERIORES) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden relative">
             <div className="absolute top-0 left-0 h-full w-2 bg-primary" />
             <CardContent className="p-8">
               <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                   <Users className="w-8 h-8" />
                 </div>
                 <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Total Registrados</p>
                   {loadingData ? (
                     <Loader2 className="w-6 h-6 animate-spin text-slate-300 mt-2" />
                   ) : (
                     <p className="text-4xl font-black text-slate-800">{clientes.length}</p>
                   )}
                 </div>
               </div>
             </CardContent>
          </Card>
        </div>

        {/* TABLA DE CLIENTES */}
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/80 pb-6 pt-8 px-8 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Directorio de Usuarios
            </CardTitle>
            {!loadingData && (
               <div className="bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-lg">
                 Mostrando {clientes.length} resultados
               </div>
            )}
          </CardHeader>
          <div className="overflow-x-auto max-h-[500px]">
            {loadingData ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando datos desde la nube...</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/50 text-xs text-slate-400 uppercase font-black tracking-wider border-b-2 border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-8 py-5">Nombre Completo</th>
                    <th scope="col" className="px-8 py-5">Correo Electrónico</th>
                    <th scope="col" className="px-8 py-5">Teléfono</th>
                    <th scope="col" className="px-8 py-5">Nacimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.length > 0 ? (
                    clientes.map((cliente) => (
                      <tr key={cliente.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-8 py-5">
                          <span className="font-bold text-slate-800 group-hover:text-primary transition-colors">{cliente.nombre}</span>
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-medium">{cliente.email}</td>
                        <td className="px-8 py-5 text-slate-500 font-medium">
                          {cliente.telefono.includes("Sin ") ? (
                            <span className="text-slate-300 italic">{cliente.telefono}</span>
                          ) : (
                            cliente.telefono
                          )}
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-medium">
                          {cliente.fechaNacimiento === "N/A" ? (
                            <span className="text-slate-300 italic">—</span>
                          ) : (
                            cliente.fechaNacimiento
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <AlertTriangle className="w-8 h-8 text-slate-300" />
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay clientes registrados en la base de datos.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* PANELES DE HERRAMIENTAS RESTAURADOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t-2 border-slate-100 border-dashed mt-8">
          
          {/* T1. ZONA DE PRUEBAS */}
          <Card className="border-none shadow-xl shadow-blue-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-blue-100">
            <div className="bg-blue-50/50 p-6 border-b border-blue-100/50 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-blue-600">
                <FlaskConical className="w-5 h-5" />
                <h3 className="font-bold text-lg">Zona de Pruebas</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium line-clamp-2">Herramientas dirigidas exclusivamente al target {TEST_TARGET_EMAIL}.</p>
            </div>
            <CardContent className="p-6 space-y-4 bg-slate-50/20">
               {isSearchingTestUser ? (
                 <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Buscando target...</p>
               ) : testUser ? (
                 <div className="p-3 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4" /> Activo (Sellos: {testUser.sellos})
                 </div>
               ) : (
                 <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-100 mb-4">
                    Target no registrado en Base de Datos.
                 </div>
               )}
               
               <Button onClick={runGeofenceDemo} disabled={actionLoading || !testUser} variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl text-blue-700 bg-blue-50/50 font-bold hover:text-blue-600 hover:bg-blue-100 border-blue-200 shadow-sm transition-all">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />} 
                  {actionLoading ? "Enviando Notificación..." : "Simular Cercanía (Geofence)"}
               </Button>
               
               <div className="pt-2">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <Sparkles className="w-3 h-3 text-purple-400" /> Mensajes Predeterminados IA
                 </p>
                 <div className="space-y-2">
                   <Button onClick={() => runAIDemo('Bienvenida', 'Hola Nachito, ¡veo que es tu primera visita de la semana! ¿Sabías que hoy hay 2x1 en cafés en el patio?')} disabled={actionLoading || !testUser} variant="outline" className="w-full text-left justify-start gap-3 py-3 h-auto rounded-xl text-purple-700 bg-purple-50/40 font-medium text-[11px] hover:bg-purple-100 border-purple-200/60 shadow-sm">
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-purple-200 flex items-center justify-center text-[9px] shrink-0">A</span> 
                          Bienvenida
                        </p>
                        <p className="text-[9px] text-purple-800/60 font-normal leading-tight line-clamp-1 mt-1.5 pl-7">Hola Nachito, ¡veo que es tu pri...</p>
                      </div>
                   </Button>
                   <Button onClick={() => runAIDemo('Fidelización', '¡Casi lo logras! Estás a solo 2 sellos de completar tu tarjeta de Murú Cosmética. ¡No te rindas!')} disabled={actionLoading || !testUser} variant="outline" className="w-full text-left justify-start gap-3 py-3 h-auto rounded-xl text-purple-700 bg-purple-50/40 font-medium text-[11px] hover:bg-purple-100 border-purple-200/60 shadow-sm">
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-purple-200 flex items-center justify-center text-[9px] shrink-0">B</span> 
                          Fidelización
                        </p>
                        <p className="text-[9px] text-purple-800/60 font-normal leading-tight line-clamp-1 mt-1.5 pl-7">¡Casi lo logras! Estás a solo 2 s...</p>
                      </div>
                   </Button>
                   <Button onClick={() => runAIDemo('Cumpleaños', '¡Feliz cumpleaños, Nachito! 🎉 El Patio Curauma te tiene un regalo especial esperándote en el mostrador.')} disabled={actionLoading || !testUser} variant="outline" className="w-full text-left justify-start gap-3 py-3 h-auto rounded-xl text-purple-700 bg-purple-50/40 font-medium text-[11px] hover:bg-purple-100 border-purple-200/60 shadow-sm">
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-purple-200 flex items-center justify-center text-[9px] shrink-0">C</span> 
                          Cumpleaños
                        </p>
                        <p className="text-[9px] text-purple-800/60 font-normal leading-tight line-clamp-1 mt-1.5 pl-7">¡Feliz cumpleaños, Nachito! 🎉...</p>
                      </div>
                   </Button>
                 </div>
               </div>

               <div className="pt-2 border-t border-slate-100 mt-2">
                 <Button onClick={runAutoStampTest} disabled={actionLoading || !testUser} variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl text-amber-700 bg-amber-50/50 font-bold hover:text-amber-600 hover:bg-amber-100 border-amber-200 shadow-sm transition-all">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    Otorgar Sello de Prueba
                 </Button>
               </div>
            </CardContent>
          </Card>

          {/* T2. GESTION DE ROLES */}
          <Card className="border-none shadow-xl shadow-primary/5 rounded-3xl bg-white overflow-hidden outline outline-1 outline-primary/10">
            <div className="bg-primary/5 p-6 border-b border-primary/10 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-primary">
                <UserCog className="w-5 h-5" />
                <h3 className="font-bold text-lg">Gestión de Roles</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium line-clamp-2">Busca clientes y modifica sus accesos a la plataforma.</p>
            </div>
            <CardContent className="p-6 space-y-4 bg-slate-50/20">
              <form onSubmit={handleSearchUserForRole} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Buscar por correo..." 
                    className="pl-9 bg-white border-slate-200 rounded-xl h-12 text-sm focus:ring-primary shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loadingRole} className="rounded-xl h-12 px-4 shadow-sm font-bold bg-primary text-white">
                  {loadingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </Button>
              </form>

              {foundUser && (
                <div className="mt-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800 line-clamp-1">{foundUser.nombre}</p>
                    <p className="text-[10px] text-slate-500">{foundUser.correo}</p>
                    <Badge variant="outline" className="w-fit text-[9px] mt-1 uppercase font-black bg-slate-50">Rol actual: {foundUser.rol || 'cliente'}</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center mt-1">Nivel de Acceso</p>
                    <div className="flex gap-1.5 flex-col md:flex-row">
                      <Button 
                        size="sm" 
                        variant={foundUser.rol === 'cliente' ? 'default' : 'outline'} 
                        className="flex-1 h-9 text-[10px] font-bold rounded-lg"
                        disabled={actionLoading}
                        onClick={() => updateUserRole('cliente')}
                      >Cliente</Button>
                      <Button 
                        size="sm" 
                        variant={foundUser.rol === 'emprendedor' ? 'default' : 'outline'} 
                        className="flex-1 h-9 text-[10px] font-bold rounded-lg"
                        disabled={actionLoading}
                        onClick={() => updateUserRole('emprendedor')}
                      >Emprendedor</Button>
                      <Button 
                        size="sm" 
                        variant={foundUser.rol === 'director_patio' ? 'default' : 'outline'} 
                        className="flex-1 h-9 text-[10px] font-bold rounded-lg"
                        disabled={actionLoading}
                        onClick={() => updateUserRole('director_patio')}
                      >Director Patio</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* T3. DETECCION DE ANOMALIAS */}
          <Card className="border-none shadow-xl shadow-amber-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-amber-100">
            <div className="bg-amber-50/50 p-6 border-b border-amber-100/50 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-amber-600">
                <Zap className="w-5 h-5" />
                <h3 className="font-bold text-lg">Detección de Anomalías</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium line-clamp-2">Vigila comportamientos inusuales en eventos del sistema.</p>
            </div>
            <CardContent className="p-0 bg-slate-50/20 max-h-[300px] overflow-y-auto">
              <div className="divide-y divide-slate-100">
                {recentTrans.length > 0 ? (
                  recentTrans.map((log) => (
                    <div key={log.id} className="p-5 flex items-center justify-between hover:bg-white transition-colors cursor-default">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">
                          <span className="text-primary">{log.usuario || "Admin"}</span> {log.accion || "System Call"}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">
                          {log.fecha ? new Date(log.fecha).toLocaleTimeString() : "--:--"} • TICKET: {log.id.slice(0,6)}
                        </p>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-slate-300" />
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                       <Zap className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">El sistema está limpio.</p>
                    <p className="text-[10px] text-slate-400">No hay actividad anómala reciente.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
        </div>
      </div>

      {/* MOCKUP VISUAL DE CELULAR PARA LA DEMO */}
      {showPhoneMockup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="relative w-[300px] aspect-[9/19] bg-slate-50 overflow-hidden shadow-2xl rounded-[3rem] border-[12px] border-slate-900 flex flex-col items-center pt-5 animate-in slide-in-from-bottom-10 zoom-in-95 duration-500">
             
             {/* Notch (Cámara e isla inteligente) */}
             <div className="absolute top-0 w-28 h-6 bg-slate-900 rounded-b-2xl shadow-sm z-20"></div>
             
             {/* Fondo de Burbujas o UI ficticia  */}
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-primary/5 opacity-50"></div>
             
             {/* Notificación Contenedora  */}
             <div className="relative z-10 w-full px-3 mt-8">
               <div className="bg-white/95 backdrop-blur-2xl p-4 rounded-[1.5rem] shadow-xl shadow-black/5 border border-white/80 animate-in slide-in-from-top-6 fade-in duration-500 delay-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 relative">
                      <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-inner">
                         {phoneMessage.type.includes('Geofence') ? <Navigation className="w-3 h-3 text-white" /> : <Sparkles className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 tracking-wider">CLUB PATIO</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Ahora</span>
                  </div>
                  
                  <div className="pl-1 space-y-1">
                    <h4 className="text-sm font-black text-slate-900 leading-tight tracking-tight">{phoneMessage.title}</h4>
                    <p className="text-[11px] text-slate-600 font-medium leading-normal">{phoneMessage.text}</p>
                  </div>
               </div>
             </div>

             {/* UI Central Falsa del Celular bloqueado */}
             <div className="flex-1 w-full flex items-center justify-center relative z-10 p-6 opacity-30 mt-10">
                <div className="text-center w-full">
                  <div className="w-16 h-16 rounded-full bg-slate-200/80 mx-auto flex items-center justify-center mb-4">
                    <ShieldCheck className="w-8 h-8 text-slate-400" />
                  </div>
                  <div className="h-2 w-3/4 bg-slate-200 rounded-full mx-auto mb-2"></div>
                  <div className="h-2 w-1/2 bg-slate-200 rounded-full mx-auto"></div>
                </div>
             </div>
             
             {/* Barra de swipe de iOS en base */}
             <div className="absolute bottom-4 left-0 w-full flex justify-center z-10">
               <div className="w-1/3 h-1.5 bg-slate-400/80 rounded-full"></div>
             </div>
          </div>
          
          <Button 
             variant="secondary"
             onClick={() => setShowPhoneMockup(false)}
             className="absolute bottom-8 font-black px-10 h-14 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl shadow-xl hover:scale-105 transition-transform"
          >
            Aceptar Mensaje (Cerrar)
          </Button>
        </div>
      )}

    </main>
  );
}
