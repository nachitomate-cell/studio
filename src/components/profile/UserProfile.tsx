
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
  ChevronRight, Calendar, FlaskConical, Navigation
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
import { verificarYGenerarRecordatorioIA, procesarProximidadGeofence } from "@/lib/notificaciones";

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

        // Al cargar los datos del usuario, verificamos si toca generar un recordatorio IA
        verificarYGenerarRecordatorioIA(user.uid, data.nombre, data.comprasRealizadas || 0);
      }
    });

    // Cargar notificaciones
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
      toast({
        title: "Perfil actualizado",
        description: "Tus datos se han guardado correctamente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: "No se pudieron actualizar los datos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePurchase = async () => {
    if (!user) return;
    setLoading(true);
    await registrarCompra(db, user.uid);
    setLoading(false);
    toast({
      title: "¡Sello Acumulado!",
      description: "Has sumado un sello a tu Club Patio.",
    });
  };

  const handleTestGeofence = async () => {
    if (!user || !userData) return;
    setLoading(true);
    await procesarProximidadGeofence(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0, true);
    setLoading(false);
    toast({
      title: "Simulación de Geovalla",
      description: "Se ha disparado el motor de cercanía geográfica.",
    });
  };

  const handleForceAINotif = async () => {
    if (!user || !userData) return;
    setLoading(true);
    // Forzamos el recordatorio ignorando el cooldown de 24h para esta prueba
    await verificarYGenerarRecordatorioIA(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0);
    setLoading(false);
    toast({
      title: "Motor GenAI activado",
      description: "La IA ha redactado una nueva oferta para ti.",
    });
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
            <p className="text-muted-foreground px-4">
              Inicia sesión para acumular sellos y participar en nuestros sorteos exclusivos.
            </p>
          </div>
          <Button 
            onClick={onShowAuth} 
            className="w-full rounded-xl h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20"
          >
            <UserIcon className="w-5 h-5" /> Entrar al Club
          </Button>
        </div>
      </div>
    );
  }

  const rol = userData?.rol || "cliente";
  const isEntrepreneur = rol === "emprendedor";
  const sellos = userData?.comprasRealizadas || 0;
  const tickets = userData?.ticketsSorteo || 0;
  
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);
  const sellosRestantesParaPremio = 5 - (sellos % 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className={cn(
          "h-24 bg-gradient-to-r",
          isEntrepreneur ? "from-accent/30 to-primary/20" : "from-primary/20 to-accent/20"
        )} />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex justify-between items-end mb-4">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white shadow-md bg-white">
                <AvatarFallback className={cn("flex items-center justify-center bg-white")}>
                  {renderAvatarIcon(isEditing ? editForm.avatarId : (userData?.avatarId || 'User'), "w-10 h-10")}
                </AvatarFallback>
              </Avatar>
            </div>
            {!isEditing ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full border-primary/20 text-primary"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" className="rounded-full bg-primary" onClick={handleSaveProfile} disabled={loading}>
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {isEditing ? (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre Completo</Label>
                  <Input 
                    value={editForm.nombre} 
                    onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                    placeholder="Tu nombre"
                    className="rounded-xl bg-slate-50 border-none shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Teléfono / WhatsApp</Label>
                  <Input 
                    value={editForm.telefono} 
                    onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                    placeholder="+56 9..."
                    className="rounded-xl bg-slate-50 border-none shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Seleccionar Avatar</Label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATAR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setEditForm({...editForm, avatarId: opt.id})}
                        className={cn(
                          "aspect-square rounded-xl flex items-center justify-center transition-all",
                          editForm.avatarId === opt.id 
                            ? "bg-primary text-white scale-110 shadow-md" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        <opt.icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>

                {isEntrepreneur && (
                  <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de la Tienda</Label>
                      <Input 
                        value={editForm.nombreTienda} 
                        onChange={(e) => setEditForm({...editForm, nombreTienda: e.target.value})}
                        className="rounded-xl bg-slate-50 border-none shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción</Label>
                      <Textarea 
                        value={editForm.descripcion} 
                        onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})}
                        className="rounded-xl bg-slate-50 border-none shadow-inner min-h-[80px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-primary">
                    {userData?.nombre || "Usuario"}
                  </h2>
                  <Badge variant={isEntrepreneur ? "default" : "outline"} className="text-[10px] font-bold uppercase">
                    {isEntrepreneur ? "Emprendedor" : "Miembro Club"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {userData?.telefono || "Sin teléfono registrado"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isEntrepreneur && (
        <>
          {/* Zona de Pruebas (Debug) */}
          <section className="bg-slate-100/50 p-4 rounded-3xl border border-slate-200 border-dashed space-y-3">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <FlaskConical className="w-4 h-4" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest">Zona de Pruebas</h4>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={handleTestGeofence} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold">
                <Navigation className="w-3 h-3" /> Proximidad
              </Button>
              <Button onClick={handleForceAINotif} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold">
                <Sparkles className="w-3 h-3" /> Generar IA
              </Button>
              <Button onClick={handleSimulatePurchase} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold">
                <Gift className="w-3 h-3" /> Sumar Sello
              </Button>
            </div>
          </section>

          {/* Centro de Notificaciones y Mensajes IA */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg text-primary">Mensajes del Club</h3>
            </div>
            
            <div className="space-y-3">
              {notificaciones.length > 0 ? (
                notificaciones.map((notif) => (
                  <Card key={notif.id} className={cn(
                    "border-none shadow-sm rounded-2xl overflow-hidden transition-all",
                    notif.isAI ? "bg-gradient-to-br from-white to-primary/5 border-l-4 border-l-primary" : "bg-white"
                  )}>
                    <CardContent className="p-4 flex gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        notif.isAI ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                      )}>
                        {notif.isAI ? <Sparkles className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-800">{notif.titulo}</h4>
                          <span className="text-[8px] text-slate-400 uppercase font-bold">
                            {new Date(notif.fecha).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {notif.mensaje}
                        </p>
                        {notif.cta && (
                          <Button variant="link" className="p-0 h-auto text-primary text-xs font-bold gap-1">
                            {notif.cta} <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
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
                <h3 className="text-2xl font-black flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-300" />
                  {tickets} <span className="text-sm font-bold opacity-90">Tickets</span>
                </h3>
              </div>
              <Sparkles className="w-10 h-10 opacity-20" />
            </CardContent>
          </Card>

          <section className="space-y-4">
            <h3 className="font-bold text-lg text-primary flex items-center gap-2 px-1">
              <Award className="w-5 h-5" />
              Mi Tarjeta de Sellos
            </h3>

            <Card className="border-none shadow-xl bg-[#FDFCF0] rounded-[2rem] overflow-hidden relative">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <img src="/Logo.png" alt="Patio" className="h-10 object-contain grayscale opacity-60" />
                </div>

                <div className="grid grid-cols-5 gap-4 mb-8">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const isFilled = i < sellosEnTarjeta;
                    return (
                      <div key={i} className="aspect-square relative flex items-center justify-center">
                        <div className={cn(
                          "w-full h-full rounded-full flex items-center justify-center",
                          isFilled 
                            ? "bg-white shadow-inner" 
                            : "bg-primary/5 border-2 border-dashed border-primary/20"
                        )}>
                          {isFilled ? (
                            <CheckCircle2 className="w-8 h-8 text-primary fill-primary/10" />
                          ) : (
                            <span className="text-[10px] font-bold text-primary/20">{i + 1}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4 text-center">
                  <p className="text-primary font-bold text-lg leading-tight px-4">
                    {sellos % 5 === 0 && sellos > 0 
                      ? "¡Tienes un premio listo para canjear!" 
                      : `¡Te faltan ${sellosRestantesParaPremio === 5 ? 5 : sellosRestantesParaPremio} sellos para tu próximo premio!`}
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <Button 
                      className="w-full h-12 rounded-2xl bg-primary text-white font-bold"
                      onClick={() => document.getElementById('premios-catalogo')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Canjear Sellos por Premios
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
            <CardContent className="flex flex-col items-center py-8">
              <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-4">Escanea esto en el local</p>
              <div className="p-4 bg-white border-2 border-primary/5 rounded-3xl shadow-inner">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${user.uid}&color=4EAD1F`}
                  alt="QR"
                  className="w-44 h-44"
                />
              </div>
            </CardContent>
          </Card>

          <div id="premios-catalogo">
            <CatalogoPremios 
              userId={user.uid} 
              userEmail={user.email || undefined} 
              comprasActuales={sellos} 
            />
          </div>
        </>
      )}

      {isEntrepreneur && (
        <div className="space-y-6">
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
          <div id="premios-catalogo-vendedor">
            <CatalogoPremios userId={user.uid} comprasActuales={sellos} />
          </div>
        </div>
      )}

      {/* SECCIÓN DE SOPORTE Y REDES SOCIALES */}
      <section className="space-y-4 pt-6">
        <div className="flex items-center gap-2 px-1">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm text-slate-500 uppercase tracking-widest">Información y Soporte</h3>
        </div>
        
        <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              <div className="text-xs text-slate-600">
                <p className="font-bold text-slate-800">{PATIO_INFO.address}</p>
                <p>{PATIO_INFO.city}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-pink-500/20 text-pink-600 gap-2 font-bold text-xs"
                onClick={() => window.open(`https://instagram.com/${PATIO_INFO.instagram}`, '_blank')}
              >
                <Instagram className="w-4 h-4" /> Instagram
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-blue-500/20 text-blue-600 gap-2 font-bold text-xs"
                onClick={() => window.open(`https://facebook.com/${PATIO_INFO.facebook}`, '_blank')}
              >
                <Facebook className="w-4 h-4" /> Facebook
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-slate-500/20 text-slate-800 gap-2 font-bold text-xs"
                onClick={() => window.open(`https://www.tiktok.com/@${PATIO_INFO.tiktok}`, '_blank')}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
                </svg>
                TikTok
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="text-center py-4">
        <Button onClick={handleLogout} variant="ghost" className="text-destructive font-bold text-xs gap-2">
          <LogOut className="w-4 h-4" /> Cerrar Sesión del Club
        </Button>
        <p className="text-[10px] text-muted-foreground font-medium uppercase mt-4">
          © {new Date().getFullYear()} {PATIO_INFO.name}
        </p>
      </div>
    </div>
  );
}
