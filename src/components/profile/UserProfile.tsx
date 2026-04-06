
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
  Clock, Bell, CheckCircle2,
  Info, ExternalLink, Instagram, Facebook, Sparkles
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
      console.error("Error al actualizar perfil:", error);
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
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>X</Button>
                <Button size="sm" className="rounded-full bg-primary" onClick={handleSaveProfile} disabled={loading}>
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-primary">
                {userData?.nombre || "Usuario"}
              </h2>
              <Badge variant={isEntrepreneur ? "default" : "outline"} className="text-[10px] font-bold uppercase">
                {isEntrepreneur ? "Emprendedor" : "Miembro Club"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {!isEntrepreneur && (
        <>
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
                    <Button variant="ghost" onClick={handleSimulatePurchase} className="text-[10px] opacity-20 uppercase font-bold">
                      (Demo: Sumar Sello)
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
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47-.13 3.35-.13 6.7.01 10.05.05 1.77-.55 3.65-1.92 4.81-1.47 1.25-3.63 1.48-5.38.83-2.14-.76-3.62-3.04-3.56-5.31.02-2.29 1.54-4.51 3.73-5.2.2-.06.4-.11.61-.15.01-1.57.01-3.14.01-4.71-1.85.24-3.69 1.05-4.99 2.41C5.51 12.35 4.96 14.3 5.02 16.3c.12 3.52 2.64 6.78 6.07 7.57 3.55.8 7.42-.91 8.87-4.23.47-1.12.63-2.35.53-3.55V0H12.525z"/>
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
