
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
  Edit3, Trophy, Megaphone, Loader2, Store, ToggleLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  collection, query, where, getDocs,
  addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, orderBy, limit, getDoc,
  arrayUnion, setDoc, serverTimestamp
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasVendorRole, setHasVendorRole] = useState(false);
  const [activatingStore, setActivatingStore] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);
  const [premios, setPremios] = useState<any[]>([]);
  const [mensajeGlobal, setMensajeGlobal] = useState({ titulo: "", cuerpo: "" });

  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [deletingVendor, setDeletingVendor] = useState(false);
  const [isPremioModalOpen, setIsPremioModalOpen] = useState(false);
  const [vendorList, setVendorList] = useState<{ id: string; nombre: string }[]>([]);
  const [premioForm, setPremioForm] = useState<{
    id: string | null;
    nombre: string;
    descripcion: string;
    sellosRequeridos: number;
    icono: string;
    vendorId: string;
    esSorteo: boolean;
    activo: boolean;
    stock: number;
  }>({ id: null, nombre: '', descripcion: '', sellosRequeridos: 5, icono: '🎁', vendorId: '', esSorteo: false, activo: true, stock: 0 });

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
        setCurrentUserId(user.uid);
        const masterEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com").trim().toLowerCase();
        if ((user.email ?? "").trim().toLowerCase() === masterEmail) {
          setIsAuthorized(true);
        } else {
          try {
             const userDoc = await getDoc(doc(db, "usuarios", user.uid));
             const userData = userDoc.data();
             const rolStr: string = userData?.rol ?? "";
             const rolesArr: string[] = Array.isArray(userData?.roles) ? userData.roles : [];
             const isDirector = rolesArr.includes("director") || rolesArr.includes("director_patio") ||
               rolStr === "director" || rolStr === "director_patio";
             if (userDoc.exists() && isDirector) {
                setIsAuthorized(true);
                const isVendor = rolesArr.includes("emprendedor") || rolStr === "emprendedor";
                setHasVendorRole(isVendor);
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

    // Escuchar premios en tiempo real (nueva colección)
    const unsubPremios = onSnapshot(collection(db, "premios"), (snap) => {
      setPremios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Cargar lista de vendors para el formulario
    getDocs(collection(db, "entrepreneur_profiles"))
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, nombre: d.data().businessName || d.data().nombre || d.id.substring(0, 8) }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setVendorList(list);
      })
      .catch(() => {});

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
        descripcion: premio.descripcion || '',
        sellosRequeridos: premio.sellosRequeridos || premio.sellos_requeridos || 5,
        icono: premio.icono || '🎁',
        vendorId: premio.vendorId || '',
        esSorteo: premio.esSorteo || false,
        activo: premio.activo !== false,
        stock: premio.stock || 0,
      });
    } else {
      setPremioForm({ id: null, nombre: '', descripcion: '', sellosRequeridos: 5, icono: '🎁', vendorId: '', esSorteo: false, activo: true, stock: 0 });
    }
    setIsPremioModalOpen(true);
  };

  const handleSavePremio = async () => {
    if (!premioForm.nombre || !premioForm.sellosRequeridos) return;
    setLoading(true);
    try {
      const vendorInfo = vendorList.find((v) => v.id === premioForm.vendorId);
      const vendorNombre = vendorInfo?.nombre || "Patio Curauma";

      const data: Record<string, any> = {
        nombre: premioForm.nombre,
        descripcion: premioForm.descripcion,
        sellosRequeridos: Number(premioForm.sellosRequeridos),
        icono: premioForm.icono,
        vendorId: premioForm.vendorId || "",
        vendorNombre,
        esSorteo: premioForm.esSorteo,
        activo: premioForm.activo,
        stock: Number(premioForm.stock),
      };

      if (premioForm.id) {
        await updateDoc(doc(db, "premios", premioForm.id), data);
        toast({ title: "Premio Actualizado" });
      } else {
        await addDoc(collection(db, "premios"), {
          ...data,
          creadoEn: serverTimestamp(),
          creadoPor: currentUserId,
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

  const handleActivateStore = async () => {
    if (!currentUserId || !auth.currentUser) return;
    setActivatingStore(true);
    try {
      await updateDoc(doc(db, "usuarios", currentUserId), {
        roles: arrayUnion("emprendedor")
      });
      await setDoc(doc(db, "entrepreneur_profiles", currentUserId), {
        businessName: "",
        description: "",
        category: "",
        imageUrls: [],
        createdAt: new Date().toISOString(),
        active: true
      }, { merge: true });
      setHasVendorRole(true);
      toast({ title: "¡Tienda activada!", description: "Ya puedes gestionar tu tienda desde el perfil." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo activar la tienda." });
    } finally {
      setActivatingStore(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!vendorToDelete || !auth.currentUser) return;
    setDeletingVendor(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/delete-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: vendorToDelete.id, idToken }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Local eliminado correctamente" });
      setVendorToDelete(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo eliminar el local." });
    } finally {
      setDeletingVendor(false);
    }
  };

  const handleDeletePremio = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este premio?")) {
      await deleteDoc(doc(db, "premios", id));
      toast({ title: "Premio Eliminado" });
    }
  };

  const handleToggleActivo = async (id: string, activo: boolean) => {
    await updateDoc(doc(db, "premios", id), { activo: !activo });
    toast({ title: activo ? "Premio desactivado" : "Premio activado" });
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
                ranking.slice(0, 5).map((emp, i) => (
                  <div key={emp.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-2xl group">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{emp.nombreTienda || emp.nombre || "Local Aliado"}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black">{emp.rubro || "General"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-black text-primary">{emp.sellosEntregados || 0}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Sellos Mes</p>
                      </div>
                      <button
                        onClick={() => setVendorToDelete({ id: emp.id, nombre: emp.nombreTienda || emp.nombre || "Local Aliado" })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50"
                        title="Eliminar local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 text-xl">
                        {premio.esSorteo ? <Ticket className="w-5 h-5 text-yellow-600" /> : (premio.icono || '🎁')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 truncate">{premio.nombre}</p>
                          <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${premio.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {premio.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{premio.vendorNombre || 'Sin local asignado'}</p>
                        <p className="text-[10px] text-primary font-black uppercase">
                          {premio.sellosRequeridos || 0} sellos
                          {premio.stock > 0 ? ` · Stock: ${premio.stock}` : ' · Stock ilimitado'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button onClick={() => handleToggleActivo(premio.id, premio.activo)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-amber-500" title={premio.activo ? "Desactivar" : "Activar"}>
                        {premio.activo ? <Users className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      </Button>
                      <Button onClick={() => handleOpenPremioModal(premio)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-primary"><Edit3 className="w-4 h-4" /></Button>
                      <Button onClick={() => handleDeletePremio(premio.id)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 italic">No hay premios configurados. Crea el primero.</div>
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

        {/* MI TIENDA COMO EMPRENDEDOR */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <Store className="w-4 h-4" /> Mi Tienda
          </h2>
          {hasVendorRole ? (
            <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-800">Tienda activa</p>
                  <p className="text-xs text-slate-400 font-medium">Gestiona tu local desde el perfil o el panel de emprendedor.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Activa tu propio local en el patio para gestionar sellos y aparecer en el directorio.
                </p>
                <Button
                  onClick={handleActivateStore}
                  disabled={activatingStore}
                  className="w-full h-12 rounded-2xl font-black gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                >
                  {activatingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                  Activar mi tienda como emprendedor
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

      </div>

      {/* MODAL ELIMINAR EMPRENDEDOR */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-300">
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-red-500" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-800">¿Eliminar local?</h2>
                  <p className="text-sm font-bold text-primary">"{vendorToDelete.nombre}"</p>
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    Se eliminarán su perfil, cuenta y solicitudes pendientes.
                    <br />Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setVendorToDelete(null)}
                  disabled={deletingVendor}
                  className="flex-1 h-12 rounded-xl font-bold border-slate-200"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteVendor}
                  disabled={deletingVendor}
                  className="flex-1 h-12 rounded-xl font-black bg-red-500 hover:bg-red-600 text-white gap-2"
                >
                  {deletingVendor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL CONFIGURACION DE PREMIOS */}
      {isPremioModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 sticky top-0 z-10">
              <CardTitle className="text-lg font-black text-slate-800">
                {premioForm.id ? "Editar Premio" : "Nuevo Premio"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre del Premio</label>
                <Input
                  value={premioForm.nombre}
                  onChange={e => setPremioForm({ ...premioForm, nombre: e.target.value })}
                  placeholder="Ej: Café gratis..."
                  className="h-12 rounded-xl"
                />
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Descripción corta</label>
                <Input
                  value={premioForm.descripcion}
                  onChange={e => setPremioForm({ ...premioForm, descripcion: e.target.value })}
                  placeholder="Ej: Un café de especialidad"
                  className="h-12 rounded-xl"
                />
              </div>

              {/* Sellos + Ícono */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sellos requeridos</label>
                  <Input
                    type="number"
                    min={1}
                    value={premioForm.sellosRequeridos}
                    onChange={e => setPremioForm({ ...premioForm, sellosRequeridos: parseInt(e.target.value) || 0 })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ícono</label>
                  <select
                    value={premioForm.icono}
                    onChange={e => setPremioForm({ ...premioForm, icono: e.target.value })}
                    className="flex h-12 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="☕">☕ Café</option>
                    <option value="🍦">🍦 Helado</option>
                    <option value="🍕">🍕 Pizza</option>
                    <option value="🎁">🎁 Regalo</option>
                    <option value="⭐">⭐ Especial</option>
                    <option value="🎟️">🎟️ Entrada</option>
                    <option value="🏷️">🏷️ Descuento</option>
                    <option value="🍷">🍷 Bebida</option>
                  </select>
                </div>
              </div>

              {/* Vendor */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Emprendedor que lo ofrece</label>
                <select
                  value={premioForm.vendorId}
                  onChange={e => setPremioForm({ ...premioForm, vendorId: e.target.value })}
                  className="flex h-12 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Patio Curauma (general) —</option>
                  {vendorList.map(v => (
                    <option key={v.id} value={v.id}>{v.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Stock */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stock disponible</label>
                <Input
                  type="number"
                  min={0}
                  value={premioForm.stock}
                  onChange={e => setPremioForm({ ...premioForm, stock: parseInt(e.target.value) || 0 })}
                  placeholder="0 = ilimitado"
                  className="h-12 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">0 = ilimitado</p>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={premioForm.esSorteo}
                    onChange={e => setPremioForm({ ...premioForm, esSorteo: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Es un Sorteo</p>
                    <p className="text-[10px] text-slate-400">No descuenta sellos, genera un ticket</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={premioForm.activo}
                    onChange={e => setPremioForm({ ...premioForm, activo: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Activo (visible al cliente)</p>
                    <p className="text-[10px] text-slate-400">Desactiva para ocultarlo sin eliminar</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
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
