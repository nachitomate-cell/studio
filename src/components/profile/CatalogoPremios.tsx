"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Ticket, Gift, Coffee, Pizza, Sparkles, Star, Loader2 } from "lucide-react";
import { canjearRecompensa } from "@/lib/puntos";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { updateDoc, doc, increment, collection, onSnapshot } from "firebase/firestore";

interface CatalogoPremiosProps {
  userId: string;
  userEmail?: string;
  comprasActuales: number;
}

export function CatalogoPremios({ userId, userEmail, comprasActuales }: CatalogoPremiosProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [premios, setPremios] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const q = collection(db, "config_premios");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbPremios = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));
      // Ordenar los premios del más barato al más caro
      dbPremios.sort((a, b) => (a.sellos_requeridos || 0) - (b.sellos_requeridos || 0));
      setPremios(dbPremios);
      setIsFetching(false);
    });
    return () => unsubscribe();
  }, []);

  const renderIcon = (iconoName: string, esSorteo: boolean) => {
    if (esSorteo) return <Ticket className="w-6 h-6" />;
    switch(iconoName?.toLowerCase()) {
      case "coffee": return <Coffee className="w-6 h-6" />;
      case "pizza": return <Pizza className="w-6 h-6" />;
      case "star": return <Star className="w-6 h-6" />;
      case "sparkles": return <Sparkles className="w-6 h-6" />;
      default: return <Gift className="w-6 h-6" />;
    }
  };

  const handleCanje = async (premio: any) => {
    setLoadingId(premio.id);
    try {
      // Si el premio es para el sorteo, actualizamos el contador de tickets
      if (premio.esSorteo) {
        const userRef = doc(db, "usuarios", userId);
        await updateDoc(userRef, {
          comprasRealizadas: increment(-(premio.sellos_requeridos || 0)),
          ticketsSorteo: increment(1)
        });
        toast({
          title: "¡Ticket de Sorteo generado!",
          description: "Ya estás participando en el Gran Sorteo del Mes. 🎉",
        });
      } else {
        await canjearRecompensa(db, userId, premio.sellos_requeridos || 0, userEmail);
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
        {isFetching ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : premios.length > 0 ? (
          premios.map((premio) => {
            const costo = premio.sellos_requeridos || 0;
            const puedeCanjear = comprasActuales >= costo;
            
            return (
              <Card 
                key={premio.id} 
                className={`overflow-hidden border-2 transition-all duration-300 ${premio.esSorteo ? 'border-yellow-400 bg-yellow-50/30' : 'border-slate-50'} ${puedeCanjear ? 'shadow-sm' : 'opacity-70'}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${premio.esSorteo ? 'bg-yellow-400 text-white' : 'bg-accent/10 text-primary'}`}>
                    {renderIcon(premio.icono, premio.esSorteo)}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className={`font-bold ${premio.esSorteo ? 'text-yellow-700' : 'text-primary'}`}>{premio.nombre}</h4>
                    <Badge variant="outline" className={`text-[10px] border-none font-bold ${premio.esSorteo ? 'text-yellow-600' : 'text-primary/40'}`}>
                      Valor: {costo} sellos
                    </Badge>
                  </div>

                  <Button 
                    size="sm"
                    disabled={!puedeCanjear || loadingId !== null}
                    onClick={() => handleCanje(premio)}
                    className={`rounded-lg h-9 px-4 font-bold ${premio.esSorteo ? 'bg-yellow-400 hover:bg-yellow-500 text-white' : 'bg-primary text-white'}`}
                  >
                    {loadingId === premio.id ? "Espere..." : puedeCanjear ? (premio.esSorteo ? "Participar" : "Canjear") : `Faltan ${costo - comprasActuales}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-6 text-sm text-slate-400 font-medium">No hay premios disponibles actualmente.</div>
        )}
      </div>
    </div>
  );
}
