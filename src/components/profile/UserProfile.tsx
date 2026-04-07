
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, Award, LogOut, 
  User as UserIcon, Phone, 
  QrCode, Edit2, Check, X, Trophy, Save, 
  Smile, Cat, Dog, Coffee, Star, Store,
  MessageCircle, MapPin, 
  Clock, Bell, CheckCircle2,
  Info, ExternalLink, Instagram, Facebook, Sparkles,
  ChevronRight, Calendar, FlaskConical, Navigation,
  LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarCompra } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { CatalogoPremios } from "./CatalogoPremios";
import { cn } from "@/lib/utils";
import { PATIO_INFO } from "@/lib/data";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { verificarYGenerarRecordatorioIA, procesarProximidadGeofence, dispararAlertaSistema } from "@/lib/notificaciones";

const AVATAR_OPTIONS = [
  { id: 'User', icon: UserIcon, color: 'bg-slate-100 text-slate-600' },
  { id: 'Smile', icon: Smile, color: 'bg-yellow-100 text-yellow-600' },
  { id: 'Cat', icon: Cat, color: 'bg-orange-100 text-orange-600' },
  { id: 'Dog', icon: Dog, color: 'bg-blue-100 text-blue-600' },
  { id: 'Coffee', icon: Coffee, color: 'bg-amber-100 text-amber-800' },
  { id: 'Star', icon: Star, color: 'bg-purple-100 text-purple-600' },
];

interface UserProfileProps {
  onSwitchMode: () => void;
  onShowAuth: () => void;
}

export function UserProfile({ onShowAuth }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userData, setUserData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const { toast } = useToast();

  const [editForm, setEditForm] = useState({
    nombre: "",
    telefono: "",
    avatarId: "User",
    fechaNacimiento: "",
    nombreTienda: "",
    rubro: "",
    descripcion: "",
    whatsapp: "",
    instagram: "",
    ubicacionTienda: "",
    promoOptIn: false
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    if ("Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    const userRef = doc(db, "usuarios", user.uid);
    const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setEditForm({
          nombre: data.nombre || "",
          telefono: data.telefono || "",
          avatarId: data.avatarId || "User",
          fechaNacimiento: data.fechaNacimiento || "",
          nombreTienda: data.nombreTienda || "",
          rubro: data.rubro || "",
          descripcion: data.descripcion || "",
          whatsapp: data.whatsapp || "",
          instagram: data.instagram || "",
          ubicacionTienda: data.ubicacionTienda || "",
          promoOptIn: data.promoOptIn || false
        });

        verificarYGenerarRecordatorioIA(user.uid, data.nombre, data.comprasRealizadas || 0);
      }
    });

    const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
    const qNotif = query(notifRef, orderBy("fecha", "desc"), limit(10));
    const unsubscribeNotif = onSnapshot(qNotif, (snapshot) => {
      setNotificaciones(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeDoc();
      unsubscribeNotif();
    };
  }, [user]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast({ title: "No compatible", description: "Tu navegador no soporta notificaciones." });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setPushEnabled(true);
      toast({ title: "¡Alertas activadas!", description: "Recibirás notificaciones en tu celular." });
      dispararAlertaSistema("¡Club Patio activado!", "Gracias por habilitar las alertas.");
    } else {
      toast({ variant: "destructive", title: "Permiso denegado", description: "Habilita las notificaciones en ajustes." });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", user.uid);
      const updateData: any = {
        nombre: editForm.nombre,
        telefono: editForm.telefono,
        avatarId: editForm.avatarId,
        fechaNacimiento: editForm.fechaNacimiento,
        promoOptIn: editForm.promoOptIn,
        updatedAt: new Date().toISOString()
      };

      if (userData?.rol === "emprendedor") {
        updateData.nombreTienda = editForm.nombreTienda;
        updateData.rubro = editForm.rubro;
        updateData.descripcion = editForm.descripcion;
        updateData.whatsapp = editForm.whatsapp;
        updateData.instagram = editForm.instagram;
        updateData.ubicacionTienda = editForm.ubicacionTienda;
      }

      await updateDoc(userRef, updateData);
      setIsEditing(false);
      toast({ title: "Perfil actualizado", description: "Tus datos se han guardado correctamente." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudieron actualizar los datos." });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePurchase = async () => {
    if (!user) return;
    setLoading(true);
    await registrarCompra(db, user.uid);
    setLoading(false);
    toast({ title: "¡Sello Acumulado!", description: "Has sumado un sello a tu Club Patio." });
  };

  const handleTestGeofence = async () => {
    if (!user || !userData) return;
    setLoading(true);
    await procesarProximidadGeofence(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0, true);
    setLoading(false);
  };

  const handleForceAINotif = async () => {
    if (!user || !userData) return;
    setLoading(true);
    await verificarYGenerarRecordatorioIA(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0);
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const renderAvatarIcon = (avatarId: string, className: string = "w-12 h-12") => {
    const option = AVATAR_OPTIONS.find(opt => opt.id === avatarId) || AVATAR_OPTIONS[0];
    const IconComponent = option.icon;
    return <IconComponent className={cn(className, option.color.split(' ')[1])} />;
  };

  if (!user) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center bg-white p-10 rounded-2xl border border-border shadow-sm text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">¡Bienvenido al Club Patio!</h2>
            <p className="text-muted-foreground px-4">Inicia sesión para acumular sellos y participar en nuestros sorteos exclusivos.</p>
          </div>
          <Button onClick={onShowAuth} className="w-full rounded-xl h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20">
            <UserIcon className="w-5 h-5" /> Entrar al Club
          </Button>
        </div>
      </div>
    );
  }

  const rol = userData?.rol || "cliente";
  const isAdmin = rol === "admin";
  const isEntrepreneur = rol === "emprendedor";
  const isDirector = rol === "director";
  const sellos = userData?.comprasRealizadas || 0;
  const tickets = userData?.ticketsSorteo || 0;
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);
  const sellosRestantesParaPremio = 5 - (sellos % 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className={cn("h-24 bg-gradient-to-r", isEntrepreneur ? "from-accent/30 to-primary/20" : isDirector ? "from-indigo-100 to-primary/20" : "from-primary/20 to-accent/20")} />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex justify-between items-end mb-4">
            <Avatar className="w-24 h-24 border-4 border-white shadow-md bg-white">
              <AvatarFallback className="flex items-center justify-center bg-white">
                {renderAvatarIcon(isEditing ? editForm.avatarId : (userData?.avatarId || 'User'), "w-10 h-10")}
              </AvatarFallback>
            </Avatar>
            {!isEditing ? (
              <Button variant="outline" size="sm" className="rounded-full border-primary/20 text-primary" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setIsEditing(false)}><X className="w-4 h-4" /></Button>
                <Button size="sm" className="rounded-full bg-primary" onClick={handleSaveProfile} disabled={loading}><Save className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-primary">{userData?.nombre || "Usuario"}</h2>
              <Badge variant={isAdmin ? "destructive" : isDirector ? "secondary" : isEntrepreneur ? "default" : "outline"} className="text-[10px] font-bold uppercase">
                {isAdmin ? "Master Admin" : isDirector ? "Director de Patio" : isEntrepreneur ? "Emprendedor" : "Miembro Club"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {!pushEnabled && (
        <Card className="border-none shadow-md bg-blue-50/50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-blue-800">Recibe avisos al celular cuando pases cerca.</p>
            </div>
            <Button size="sm" onClick={requestNotificationPermission} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Activar</Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <section className="bg-slate-100/50 p-4 rounded-3xl border border-slate-200 border-dashed space-y-3">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <FlaskConical className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest">Zona de Pruebas (Admin Only)</h4>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handleTestGeofence} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Navigation className="w-3 h-3" /> Proximidad</Button>
            <Button onClick={handleForceAINotif} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Sparkles className="w-3 h-3" /> Generar IA</Button>
            <Button onClick={handleSimulatePurchase} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Gift className="w-3 h-3" /> Sumar Sello</Button>
          </div>
        </section>
      )}

      {isDirector && (
        <section className="space-y-4 animate-in slide-in-from-bottom duration-500">
          <Card className="border-indigo-100 shadow-xl bg-white rounded-3xl overflow-hidden border-2">
            <CardHeader className="bg-indigo-50/50 pb-4">
              <CardTitle className="text-lg font-black flex items-center gap-2 text-indigo-900">
                <Trophy className="w-5 h-5 text-indigo-600" /> 
                Gestión Directiva
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Tienes acceso al panel de control global para monitorear la salud del recinto, gestionar premios y enviar comunicados.
                </p>
                <Link href="/director">
                  <Button className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg gap-3 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                    <LayoutDashboard className="w-6 h-6" /> 
                    Abrir Panel Directivo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {isEntrepreneur && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
          <Card className="border-accent/40 shadow-md bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-accent/10">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Store className="w-5 h-5" /> Mi Tienda
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Link href="/vendedor">
                <Button className="w-full h-16 rounded-3xl bg-primary text-white font-bold text-lg gap-3">
                  <QrCode className="w-6 h-6" /> Abrir Terminal de Sellos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {!isEntrepreneur && !isDirector && (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg text-primary">Mensajes del Club</h3>
            </div>
            <div className="space-y-3">
              {notificaciones.length > 0 ? (
                notificaciones.map((notif) => (
                  <Card key={notif.id} className={cn("border-none shadow-sm rounded-2xl overflow-hidden transition-all", notif.isAI ? "bg-gradient-to-br from-white to-primary/5 border-l-4 border-l-primary" : "bg-white")}>
                    <CardContent className="p-4 flex gap-4">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", notif.isAI ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                        {notif.isAI ? <Sparkles className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-800">{notif.titulo}</h4>
                          <span className="text-[8px] text-slate-400 uppercase font-bold">{new Date(notif.fecha).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{notif.mensaje}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="bg-slate-50 p-8 rounded-3xl text-center space-y-2 border-2 border-dashed border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium italic">Pronto recibirás promociones exclusivas.</p>
                </div>
              )}
            </div>
          </section>

          <Card className="border-none shadow-lg bg-gradient-to-br from-primary to-accent/40 rounded-3xl overflow-hidden text-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Gran Sorteo del Mes</p>
                <h3 className="text-2xl font-black flex items-center gap-2"><Trophy className="w-6 h-6 text-yellow-300" />{tickets} <span className="text-sm font-bold opacity-90">Tickets</span></h3>
              </div>
              <Sparkles className="w-10 h-10 opacity-20" />
            </CardContent>
          </Card>

          <section className="space-y-4">
            <h3 className="font-bold text-lg text-primary flex items-center gap-2 px-1"><Award className="w-5 h-5" />Mi Tarjeta de Sellos</h3>
            <Card className="border-none shadow-xl bg-[#FDFCF0] rounded-[2rem] overflow-hidden relative">
              <CardContent className="p-8">
                <div className="grid grid-cols-5 gap-4 mb-8">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-square relative flex items-center justify-center">
                      <div className={cn("w-full h-full rounded-full flex items-center justify-center", i < sellosEnTarjeta ? "bg-white shadow-inner" : "bg-primary/5 border-2 border-dashed border-primary/20")}>
                        {i < sellosEnTarjeta ? <CheckCircle2 className="w-8 h-8 text-primary fill-primary/10" /> : <span className="text-[10px] font-bold text-primary/20">{i + 1}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4 text-center">
                  <p className="text-primary font-bold text-lg leading-tight px-4">{sellos % 5 === 0 && sellos > 0 ? "¡Tienes un premio listo para canjear!" : `¡Te faltan ${sellosRestantesParaPremio === 5 ? 5 : sellosRestantesParaPremio} sellos para tu próximo premio!`}</p>
                  <Button className="w-full h-12 rounded-2xl bg-primary text-white font-bold" onClick={() => document.getElementById('premios-catalogo')?.scrollIntoView({ behavior: 'smooth' })}>Canjear Sellos por Premios</Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
            <CardContent className="flex flex-col items-center py-8">
              <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-4">Escanea esto en el local</p>
              <div className="p-4 bg-white border-2 border-primary/5 rounded-3xl shadow-inner">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${user.uid}&color=4EAD1F`} alt="QR" className="w-44 h-44" />
              </div>
            </CardContent>
          </Card>

          <div id="premios-catalogo">
            <CatalogoPremios userId={user.uid} userEmail={user.email || undefined} comprasActuales={sellos} />
          </div>
        </>
      )}

      <div className="text-center py-4">
        <Button onClick={handleLogout} variant="ghost" className="text-destructive font-bold text-xs gap-2"><LogOut className="w-4 h-4" /> Cerrar Sesión del Club</Button>
        <p className="text-[10px] text-muted-foreground font-medium uppercase mt-4">© {new Date().getFullYear()} {PATIO_INFO.name}</p>
      </div>
    </div>
  );
}
