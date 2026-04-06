
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, Award, LogOut, Briefcase, LogIn, 
  User as UserIcon, Phone, 
  QrCode, Edit2, Check, X, Trophy, Save, 
  Smile, Cat, Dog, Coffee, Star, Store,
  Instagram, MessageCircle, MapPin, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { registrarCompra } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { CatalogoPremios } from "./CatalogoPremios";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";

// Configuración de Avatares Predeterminados
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

export function UserProfile({ onSwitchMode, onShowAuth }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userData, setUserData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Estados del formulario de edición
  const [editForm, setEditForm] = useState({
    nombre: "",
    telefono: "",
    avatarId: "User",
    fechaNacimiento: "",
    // Campos de tienda para emprendedores
    nombreTienda: "",
    rubro: "",
    descripcion: "",
    whatsapp: "",
    instagram: "",
    ubicacionTienda: ""
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
          ubicacionTienda: data.ubicacionTienda || ""
        });
      }
    });

    return () => unsubscribeDoc();
  }, [user]);

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
        updatedAt: new Date().toISOString()
      };

      // Si es emprendedor, guardamos también los datos de la tienda
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
      title: "¡Compra Registrada!",
      description: "Has sumado una compra a tu historial.",
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
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">¡Bienvenido!</h2>
            <p className="text-muted-foreground px-4">
              Inicia sesión para ver tus puntos acumulados, gestionar tu emprendimiento y ganar recompensas.
            </p>
          </div>
          <Button 
            onClick={onShowAuth} 
            className="w-full rounded-xl h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20"
          >
            <LogIn className="w-5 h-5" /> Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  const rol = userData?.rol || "cliente";
  const isEntrepreneur = rol === "emprendedor";
  const compras = userData?.comprasRealizadas || 0;
  const meta = 5;
  const porcentaje = (compras / meta) * 100;
  const canjes = userData?.totalCanjesHistoricos || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header Perfil */}
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
                  {isEntrepreneur ? "Emprendedor" : "Cliente"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5" /> {user.email}
              </p>
              {userData?.telefono && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {userData.telefono}
                </p>
              )}
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
                  <Label htmlFor="telefono">Teléfono personal</Label>
                  <Input 
                    id="telefono" 
                    value={editForm.telefono} 
                    onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                    placeholder="+56 9 1234 5678"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fecha">Fecha de Nacimiento</Label>
                  <Input 
                    id="fecha" 
                    type="date"
                    value={editForm.fechaNacimiento} 
                    onChange={(e) => setEditForm({...editForm, fechaNacimiento: e.target.value})}
                    className="h-10 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN CONDICIONAL POR ROL */}
      
      {!isEntrepreneur ? (
        /* VISTA CLIENTE */
        <>
          {/* Código QR de Validación */}
          {!isEditing && (
            <Card className="border-accent/30 shadow-md bg-white">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-sm font-bold flex items-center justify-center gap-2 text-primary uppercase tracking-wider">
                  <QrCode className="w-5 h-5" />
                  Tu Identificador de Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4 py-6">
                <div className="p-3 bg-white border-2 border-primary/10 rounded-2xl shadow-inner">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${user.uid}&color=4EAD1F`}
                    alt="Código QR de Usuario"
                    className="w-40 h-40"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground max-w-[200px] font-medium italic">
                  "Muestra este código en los puestos al comprar para sumar puntos"
                </p>
              </CardContent>
            </Card>
          )}

          {/* Progreso Recompensas */}
          <Card className="border-primary/20 shadow-md bg-white">
            <CardHeader className="pb-2 bg-primary/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Award className="w-4 h-4" />
                Nivel de Fidelidad
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex justify-between items-end mb-1">
                <div className="flex gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] font-bold">
                    {compras} Compras
                  </Badge>
                  {canjes > 0 && (
                    <Badge className="bg-accent text-accent-foreground border-none text-[10px] font-bold flex gap-1 items-center">
                      <Trophy className="w-2.5 h-2.5" /> {canjes} Canje{canjes !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-bold text-primary">
                  {compras >= 5 ? '¡Recompensa disponible!' : `Próxima meta: ${compras}/5`}
                </span>
              </div>
              <Progress value={Math.min(porcentaje, 100)} className="h-2.5 bg-primary/10" />
              
              <Button 
                onClick={handleSimulatePurchase} 
                disabled={loading} 
                variant="ghost" 
                className="w-full text-primary hover:bg-primary/5 rounded-xl h-10 text-[10px] border border-dashed border-primary/20"
              >
                <Gift className="w-3.5 h-3.5 mr-2" />
                Simular Escaneo de Compra (Demo)
              </Button>
            </CardContent>
          </Card>

          {/* Catálogo */}
          <CatalogoPremios 
            userId={user.uid} 
            userEmail={user.email || undefined} 
            comprasActuales={compras} 
          />
        </>
      ) : (
        /* VISTA EMPRENDEDOR */
        <div className="space-y-6">
          <Card className="border-accent/40 shadow-md bg-white overflow-hidden">
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
                    {userData?.descripcion || "Aquí aparecerá la descripción de tu negocio para que los clientes te conozcan."}
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{userData?.ubicacionTienda || "Sin ubicación"}</span>
                    </div>
                    {userData?.whatsapp && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageCircle className="w-4 h-4 text-[#25D366]" />
                        <span>{userData.whatsapp}</span>
                      </div>
                    )}
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
                    <Label htmlFor="desc">Descripción del Negocio</Label>
                    <Textarea 
                      id="desc" 
                      value={editForm.descripcion} 
                      onChange={(e) => setEditForm({...editForm, descripcion: e.target.value})}
                      placeholder="Cuéntanos sobre tus productos..."
                      className="rounded-lg min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="ws">WhatsApp Tienda</Label>
                      <Input 
                        id="ws" 
                        value={editForm.whatsapp} 
                        onChange={(e) => setEditForm({...editForm, whatsapp: e.target.value})}
                        placeholder="+56 9 ..."
                        className="rounded-lg"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="ig">Instagram (@user)</Label>
                      <Input 
                        id="ig" 
                        value={editForm.instagram} 
                        onChange={(e) => setEditForm({...editForm, instagram: e.target.value})}
                        placeholder="ejemplo_tienda"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ubi">Ubicación en el Patio</Label>
                    <Input 
                      id="ubi" 
                      value={editForm.ubicacionTienda} 
                      onChange={(e) => setEditForm({...editForm, ubicacionTienda: e.target.value})}
                      placeholder="Ej: Pasillo Central, Local 4"
                      className="rounded-lg"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Acceso a Terminal de Ventas */}
          {!isEditing && (
            <Link href="/vendedor">
              <Button className="w-full h-16 rounded-2xl bg-primary text-white font-bold text-lg gap-3 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                <QrCode className="w-6 h-6" />
                Terminal de Ventas (Escanear)
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Acciones Adicionales */}
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
