
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Award, Settings, LogOut, Briefcase, LogIn, ShoppingBag, CheckCircle2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { registrarCompra } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { CatalogoPremios } from "./CatalogoPremios";

export function UserProfile({ onSwitchMode, onShowAuth }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
        setUserData(docSnap.data());
      } else {
        setUserData({ comprasRealizadas: 0, recompensaDisponible: false, puntos: 0, totalCanjesHistoricos: 0 });
      }
    });

    return () => unsubscribeDoc();
  }, [user]);

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-border shadow-sm">
        <Avatar className="w-20 h-20 border-4 border-accent/30">
          <AvatarImage src={`https://picsum.photos/seed/${user.uid}/200`} alt={user.email || "Usuario"} />
          <AvatarFallback>{user.email?.substring(0, 2).toUpperCase() || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <h2 className="text-lg font-bold text-primary truncate">
            {user.email}
          </h2>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="secondary" className="bg-accent/20 text-primary border-none text-[10px]">
              {compras} Compras acumuladas
            </Badge>
            {canjes > 0 && (
              <Badge variant="outline" className="border-primary/30 text-primary text-[10px] flex gap-1 items-center">
                <Trophy className="w-2 h-2" /> {canjes} Canjes
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Settings className="w-6 h-6" />
        </Button>
      </div>

      <Card className="border-primary/20 shadow-md overflow-hidden bg-white">
        <CardHeader className="pb-2 bg-primary/5">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
            <Award className="w-4 h-4" />
            Tu Progreso
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex justify-between items-end mb-1">
            <span className="text-xs font-medium text-muted-foreground">Acumulado: {compras} compras</span>
            <span className="text-xs font-bold text-primary">{compras >= 5 ? '¡Listo para canjear!' : `${compras}/5 para el primer premio`}</span>
          </div>
          <Progress value={Math.min(porcentaje, 100)} className="h-2" />
          
          <Button 
            onClick={handleSimulatePurchase} 
            disabled={loading} 
            variant="outline" 
            className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/5 rounded-xl h-10 text-xs"
          >
            <Gift className="w-4 h-4 mr-2" />
            Simular Compra (Prueba)
          </Button>
        </CardContent>
      </Card>

      <CatalogoPremios 
        userId={user.uid} 
        userEmail={user.email || undefined} 
        comprasActuales={compras} 
      />

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 space-y-4">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 h-12 text-primary border-primary/20 hover:bg-primary/5"
            onClick={onSwitchMode}
          >
            <Briefcase className="w-5 h-5" />
            <span className="font-bold">Gestionar mi Emprendimiento</span>
          </Button>
          
          <Separator />
          
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-primary text-left">
              Favoritos
            </Button>
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              className="w-full justify-start gap-3 h-12 text-destructive hover:bg-destructive/5 text-left"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UserProfileProps {
  onSwitchMode: () => void;
  onShowAuth: () => void;
}
