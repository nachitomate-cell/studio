
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Award, Settings, LogOut, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface UserProfileProps {
  onSwitchMode: () => void;
}

export function UserProfile({ onSwitchMode }: UserProfileProps) {
  const points = 1250;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-border shadow-sm">
        <Avatar className="w-20 h-20 border-4 border-accent/30">
          <AvatarImage src="https://picsum.photos/seed/user/200" alt="Usuario" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-primary">Juan Pérez</h2>
          <p className="text-sm text-muted-foreground">Miembro desde Enero 2024</p>
          <Badge variant="secondary" className="mt-1 bg-accent/20 text-primary border-none">
            Cliente Fiel
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
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
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-primary">
              Mis Pedidos
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-primary">
              Favoritos
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-muted-foreground hover:text-primary">
              Historial de Puntos
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-destructive hover:bg-destructive/5">
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
