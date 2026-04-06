
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Award, Settings, LogOut, Briefcase, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface UserProfileProps {
  onSwitchMode: () => void;
  onShowAuth: () => void;
}

export function UserProfile({ onSwitchMode, onShowAuth }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const points = 1250;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
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
              Inicia sesión para ver tus puntos acumulados, gestionar tu emprendimiento y guardar tus favoritos.
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-border shadow-sm">
        <Avatar className="w-20 h-20 border-4 border-accent/30">
          <AvatarImage src={`https://picsum.photos/seed/${user.uid}/200`} alt={user.email || "Usuario"} />
          <AvatarFallback>{user.email?.substring(0, 2).toUpperCase() || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <h2 className="text-lg font-bold text-primary truncate" title={user.email || ""}>
            {user.email}
          </h2>
          <p className="text-xs text-muted-foreground">Miembro de la comunidad</p>
          <Badge variant="secondary" className="mt-1 bg-accent/20 text-primary border-none">
            Cliente Activo
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Settings className="w-6 h-6" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-none shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
              <Gift className="w-4 h-4" />
              Puntos Regalo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{points}</div>
            <p className="text-xs opacity-70 mt-1">Vencen en 30 días</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-accent shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
              <Award className="w-4 h-4" />
              Nivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">Bronce</div>
            <p className="text-xs text-muted-foreground mt-1">250 pts para Plata</p>
          </CardContent>
        </Card>
      </div>

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
              Mis Pedidos
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-primary text-left">
              Favoritos
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-primary text-left">
              Historial de Puntos
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
