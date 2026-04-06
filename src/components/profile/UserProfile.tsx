
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, limit } from "firebase/firestore";
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
  Clock, Bell, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { registrarCompra } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { CatalogoPremios } from "./CatalogoPremios";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";

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
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [todayCount, setTodayCount] = useState(0);
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
      }
    });

    return () => unsubscribeDoc();
  }, [user]);

  useEffect(() => {
    if (!user || userData?.rol !== "emprendedor") return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const qToday = query(
      collection(db, "usuarios", user.uid, "ventas_registradas"),
      where("fecha", ">=", startOfToday.toISOString())
    );

    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      setTodayCount(snapshot.size);
    });

    const qRecent = query(
      collection(db, "usuarios", user.uid, "ventas_registradas"),
      orderBy("fecha", "desc"),
      limit(5)
    );

    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      setRecentSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeToday();
      unsubscribeRecent();
    };
  }, [user, userData?.rol]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", user.uid);
      const isEntrepreneur = userData?.rol === "emprendedor";
      
      const updateData: any = {
        nombre: editForm.nombre,
        telefono: editForm.telefono,
        avatarId: editForm.avatarId,
        fechaNacimiento: editForm.fechaNacimiento,
        promoOptIn: editForm.promoOptIn,
        updatedAt: new Date().toISOString()
      };

      if (isEntrepreneur) {
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
      console.error("Error al actualizar perfil:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron guardar los cambios.",
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
              Inicia sesión para acumular sellos en tus tiendas favoritas y ganar premios exclusivos.
            </p>
          </div>
          <Button 
            onClick={onShowAuth} 
            className="w-full rounded-xl h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20"
          >
            <UserIcon className="w-5 h-5" /> Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  const rol = userData?.rol || "cliente";
  const isEntrepreneur = rol === "emprendedor";
  const sellos = userData?.comprasRealizadas || 0;
  const canjes = userData?.totalCanjesHistoricos || 0;
  
  // Lógica de la tarjeta de 10 sellos
  const totalSlots = 10;
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);
  const sellosRestantesParaPremio = 5 - (sellos % 5);
  const mensajeMotivador = sellos % 5 === 0 && sellos > 0 
    ? "¡Tienes un premio listo para canjear!" 
    : `¡Te faltan ${sellosRestantesParaPremio === 5 ? 5 : sellosRestantesParaPremio} sellos para tu próximo premio!`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
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
                  {renderAvatarIcon(userData?.avatarId || editForm.avatarId, "w-10 h-10")}
                </AvatarFallback>
              </Avatar>
              {isEntrepreneur && (
                <div className="absolute -top-1 -right-1 bg-primary text-white p-1.5 rounded-full border-2 border-white shadow-sm">
                  <Store className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            {!isEditing ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full border-primary/20 text-primary hover:bg-primary/5"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full text-destructive"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
                <Button 
                  size="sm" 
                  className="rounded-full bg-primary text-white"
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  <Save className="w-4 h-4 mr-1" /> {loading ? "..." : "Guardar"}
                </Button>
              </div>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-primary">
                  {userData?.nombre || "Usuario"}
                </h2>
                <Badge variant={isEntrepreneur ? "default" : "outline"} className="text-[10px] font-bold uppercase">
                  {isEntrepreneur ? "Emprendedor" : "Miembro Club"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5" /> {user.email}
              </p>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-muted-foreground">Elige tu Avatar</Label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setEditForm({ ...editForm, avatarId: option.id })}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        option.color,
                        editForm.avatarId === option.id 
                          ? "ring-2 ring-primary ring-offset-2 scale-110" 
                          : "opacity-60 hover:opacity-100 hover:scale-105"
                      )}
                    >
                      <option.icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="nombre">Nombre Completo</Label>
                  <Input 
                    id="nombre" 
                    value={editForm.nombre} 
                    onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                    placeholder="Tu nombre"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="telefono">WhatsApp</Label>
                  <Input 
                    id="telefono" 
                    value={editForm.telefono} 
                    onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                    placeholder="+56 9 1234 5678"
                    className="h-10 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isEntrepreneur ? (
        <>
          {/* Tarjeta Física de Sellos */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                <Award className="w-5 h-5" />
                Mi Tarjeta de Sellos
              </h3>
              {canjes > 0 && (
                <Badge className="bg-accent text-accent-foreground border-none font-bold">
                  {canjes} Premios Ganados
                </Badge>
              )}
            </div>

            <Card className="border-none shadow-xl bg-[#FDFCF0] rounded-[2rem] overflow-hidden relative group">
              {/* Textura sutil de papel */}
              <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cardboard-flat.png')]" />
              
              <CardContent className="p-8 relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <img src="/Logo.png" alt="Patio" className="h-10 object-contain grayscale opacity-60" />
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest leading-none">Miembro Club</p>
                    <p className="text-xs font-bold text-primary/60">ID: {user.uid.slice(0, 8)}</p>
                  </div>
                </div>

                {/* Grilla de 10 círculos */}
                <div className="grid grid-cols-5 gap-4 mb-8">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const isFilled = i < sellosEnTarjeta;
                    return (
                      <div key={i} className="aspect-square relative flex items-center justify-center">
                        <div className={cn(
                          "w-full h-full rounded-full transition-all duration-500 flex items-center justify-center",
                          isFilled 
                            ? "bg-white shadow-inner scale-100" 
                            : "bg-primary/5 border-2 border-dashed border-primary/20 scale-95"
                        )}>
                          {isFilled ? (
                            <div className="animate-in zoom-in duration-300">
                              <CheckCircle2 className="w-8 h-8 text-primary fill-primary/10" />
                            </div>
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
                    {mensajeMotivador}
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <Button 
                      className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                      onClick={() => {
                        const premiosSection = document.getElementById('premios-catalogo');
                        premiosSection?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Ver Premios Disponibles
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      onClick={handleSimulatePurchase}
                      className="text-[10px] text-primary/40 hover:bg-transparent uppercase tracking-widest font-bold"
                    >
                      (Simular Sello Demo)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* QR de Miembro */}
          {!isEditing && (
            <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
              <CardHeader className="pb-2 text-center bg-slate-50/50">
                <CardTitle className="text-[10px] font-bold flex items-center justify-center gap-2 text-primary/60 uppercase tracking-widest">
                  <QrCode className="w-4 h-4" />
                  Muestra esto en el local
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-8">
                <div className="p-4 bg-white border-2 border-primary/5 rounded-3xl shadow-inner mb-4">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${user.uid}&color=4EAD1F`}
                    alt="Código QR de Miembro"
                    className="w-44 h-44"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notificaciones Toggle */}
          <Card className="border-none shadow-sm bg-accent/5 rounded-2xl overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">Notificaciones del Club</p>
                  <p className="text-[10px] text-muted-foreground">Recibir ofertas y promociones exclusivas</p>
                </div>
              </div>
              <Switch 
                checked={editForm.promoOptIn} 
                onCheckedChange={(checked) => setEditForm({ ...editForm, promoOptIn: checked })}
                disabled={!isEditing}
              />
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
      ) : (
        <div className="space-y-6">
          <Card className="border-accent/40 shadow-md bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-accent/10 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                <Store className="w-5 h-5" />
                Mi Tienda
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-primary">{userData?.nombreTienda || "Nombre de tu negocio"}</h3>
                    <Badge className="bg-accent/20 text-accent-foreground border-none">{userData?.rubro || "Rubro no definido"}</Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {userData?.descripcion || "Aquí aparecerá la descripción de tu negocio."}
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{userData?.ubicacionTienda || "Sin ubicación"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid gap-1.5">
                    <Label htmlFor="shopName">Nombre de la Tienda</Label>
                    <Input 
                      id="shopName" 
                      value={editForm.nombreTienda} 
                      onChange={(e) => setEditForm({...editForm, nombreTienda: e.target.value})}
                      placeholder="Ej: Sabores del Patio"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="rubro">Rubro / Categoría</Label>
                    <Input 
                      id="rubro" 
                      value={editForm.rubro} 
                      onChange={(e) => setEditForm({...editForm, rubro: e.target.value})}
                      placeholder="Ej: Gastronomía"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="desc">Descripción</Label>
                    <Textarea 
                      id="desc" 
                      value={editForm.descripcion} 
                      onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})}
                      placeholder="Cuéntanos sobre tus productos..."
                      className="rounded-lg min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
                <Clock className="w-5 h-5" />
                Sellos Entregados
              </h3>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
                Hoy: {todayCount} sellos
              </Badge>
            </div>
            
            <div className="space-y-3">
              {recentSales.length > 0 ? (
                recentSales.map((sale, idx) => (
                  <Card key={idx} className="border-none shadow-sm bg-white overflow-hidden rounded-2xl animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-primary">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-primary">{sale.clienteNombre}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(sale.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary font-bold">
                        +1 Sello
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-border">
                  <p className="text-xs text-muted-foreground italic">
                    Aún no has entregado sellos hoy.
                  </p>
                </div>
              )}
            </div>
          </div>

          {!isEditing && (
            <Link href="/vendedor">
              <Button className="w-full h-16 rounded-3xl bg-primary text-white font-bold text-lg gap-3 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                <QrCode className="w-6 h-6" />
                Terminal de Sellos (Escanear)
              </Button>
            </Link>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 space-y-3">
          <Button 
            onClick={handleLogout} 
            variant="ghost" 
            className="w-full justify-start gap-3 h-12 text-destructive hover:bg-destructive/5 text-left rounded-xl"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

