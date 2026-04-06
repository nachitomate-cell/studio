
"use client";

import { useState } from "react";
import { PREMIOS, Premio } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Lock, Check, Trophy, Ticket } from "lucide-react";
import { canjearRecompensa } from "@/lib/puntos";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { updateDoc, doc, increment } from "firebase/firestore";

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
      // Si el premio es para el sorteo, actualizamos el contador de tickets
      if (premio.esSorteo) {
        const userRef = doc(db, "usuarios", userId);
        await updateDoc(userRef, {
          comprasRealizadas: increment(-premio.costo),
          ticketsSorteo: increment(1)
        });
        toast({
          title: "¡Ticket de Sorteo generado!",
          description: "Ya estás participando en el Gran Sorteo del Mes. 🎉",
        });
      } else {
        await canjearRecompensa(db, userId, premio.costo, userEmail);
        toast({
          title: "¡Premio canjeado!",
          description: `Has obtenido "${premio.nombre}". ¡Disfrútalo!`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo procesar el canje.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <ShoppingBag className="w-5 h-5" />
        <h3 className="font-bold text-lg">Catálogo de Beneficios</h3>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {PREMIOS.map((premio) => {
          const puedeCanjear = comprasActuales >= premio.costo;
          
          return (
            <Card 
              key={premio.id} 
              className={`overflow-hidden border-2 transition-all duration-300 ${premio.esSorteo ? 'border-yellow-400 bg-yellow-50/30' : 'border-slate-50'} ${puedeCanjear ? 'shadow-sm' : 'opacity-70'}`}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${premio.esSorteo ? 'bg-yellow-400 text-white' : 'bg-accent/10'}`}>
                  {premio.esSorteo ? <Ticket className="w-6 h-6" /> : premio.icono}
                </div>
                
                <div className="flex-1">
                  <h4 className={`font-bold ${premio.esSorteo ? 'text-yellow-700' : 'text-primary'}`}>{premio.nombre}</h4>
                  <Badge variant="outline" className={`text-[10px] border-none font-bold ${premio.esSorteo ? 'text-yellow-600' : 'text-primary/40'}`}>
                    Costo: {premio.costo} sellos
                  </Badge>
                </div>

                <Button 
                  size="sm"
                  disabled={!puedeCanjear || loadingId !== null}
                  onClick={() => handleCanje(premio)}
                  className={`rounded-lg h-9 px-4 font-bold ${premio.esSorteo ? 'bg-yellow-400 hover:bg-yellow-500 text-white' : 'bg-primary text-white'}`}
                >
                  {loadingId === premio.id ? "..." : puedeCanjear ? (premio.esSorteo ? "Participar" : "Canjear") : `Faltan ${premio.costo - comprasActuales}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
