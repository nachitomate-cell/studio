
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, Award, Settings, LogOut, Briefcase, LogIn, 
  User as UserIcon, Calendar as CalendarIcon, Phone, 
  QrCode, Edit2, Check, X, Trophy, Save, Camera 
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
    fotoPerfil: "",
    fechaNacimiento: ""
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
          fotoPerfil: data.fotoPerfil || "",
          fechaNacimiento: data.fechaNacimiento || ""
        });
      } else {
        setUserData({ comprasRealizadas: 0, recompensaDisponible: false, puntos: 0, totalCanjesHistoricos: 0 });
      }
    });

    return () => unsubscribeDoc();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", user.uid);
      await updateDoc(userRef, {
        nombre: editForm.nombre,
        telefono: editForm.telefono,
        fotoPerfil: editForm.fotoPerfil,
        fechaNacimiento: editForm.fechaNacimiento,
        updatedAt: new Date().toISOString()
      });
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

  const compras = userData?.comprasRealizadas || 0;
  const meta = 5;
  const porcentaje = (compras / meta) * 100;
  const canjes = userData?.totalCanjesHistoricos || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header Perfil */}
      <div className="flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 to-accent/20" />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex justify-between items-end mb-4">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white shadow-md">
                <AvatarImage src={userData?.fotoPerfil || `https://picsum.photos/seed/${user.uid}/200`} alt="Avatar" />
                <AvatarFallback className="bg-primary text-white text-xl">
                  {userData?.nombre?.[0] || user.email?.substring(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full cursor-pointer">
                  <Camera className="w-6 h-6 text-white" />
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
              <h2 className="text-2xl font-bold text-primary">
                {userData?.nombre || "Usuario"}
              </h2>
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
            <div className="space-y-4 pt-2">
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
                  <Label htmlFor="telefono">Teléfono (WhatsApp)</Label>
                  <Input 
                    id="telefono" 
                    value={editForm.telefono} 
                    onChange={(e) => setEditForm({...editForm, telefono: e.target.value})}
                    placeholder="+56 9 1234 5678"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="foto">URL de Foto de Perfil</Label>
                  <Input 
                    id="foto" 
                    value={editForm.fotoPerfil} 
                    onChange={(e) => setEditForm({...editForm, fotoPerfil: e.target.value})}
                    placeholder="https://ejemplo.com/foto.jpg"
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

      {/* Acciones Adicionales */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 space-y-3">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 h-12 text-primary border-primary/10 hover:bg-primary/5"
            onClick={onSwitchMode}
          >
            <Briefcase className="w-5 h-5 text-accent-foreground" />
            <span className="font-bold">Portal del Emprendedor</span>
          </Button>
          
          <Separator />
          
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

interface UserProfileProps {
  onSwitchMode: () => void;
  onShowAuth: () => void;
}
