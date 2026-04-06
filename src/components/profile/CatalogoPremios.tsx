
"use client";

import { useState } from "react";
import { PREMIOS, Premio } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Lock, Check } from "lucide-react";
import { canjearRecompensa } from "@/lib/puntos";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface CatalogoPremiosProps {
  userId: string;
  userEmail?: string;
  comprasActuales: number;
}

export function CatalogoPremios({ userId, userEmail, comprasActuales }: CatalogoPremiosProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCanje = async (premio: Premio) => {
    setLoadingId(premio.id);
    try {
      await canjearRecompensa(db, userId, premio.costo, userEmail);
      toast({
        title: "¡Recompensa canjeada con éxito!",
        description: `Has canjeado "${premio.nombre}". ¡Disfrútalo en el Patio!`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al canjear",
        description: "Hubo un problema procesando tu canje. Inténtalo de nuevo.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <ShoppingBag className="w-5 h-5" />
        <h3 className="font-bold text-lg">Catálogo de Premios</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {PREMIOS.map((premio) => {
          const puedeCanjear = comprasActuales >= premio.costo;
          
          return (
            <Card 
              key={premio.id} 
              className={`overflow-hidden transition-all duration-300 ${puedeCanjear ? 'border-accent shadow-sm' : 'opacity-75 grayscale-[0.5]'}`}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-2xl">
                  {premio.icono}
                </div>
                
                <div className="flex-1">
                  <h4 className="font-bold text-primary">{premio.nombre}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-bold border-accent text-accent-foreground">
                      Costo: {premio.costo} compras
                    </Badge>
                  </div>
                </div>

                <Button 
                  size="sm"
                  disabled={!puedeCanjear || loadingId !== null}
                  onClick={() => handleCanje(premio)}
                  className={`rounded-lg h-9 px-4 font-bold ${puedeCanjear ? 'bg-accent text-accent-foreground hover:bg-accent/80' : 'bg-muted text-muted-foreground'}`}
                >
                  {loadingId === premio.id ? (
                    "Procesando..."
                  ) : puedeCanjear ? (
                    <span className="flex items-center gap-1"><Check className="w-4 h-4" /> Canjear</span>
                  ) : (
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Faltan {premio.costo - comprasActuales}</span>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
