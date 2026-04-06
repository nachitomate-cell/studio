
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  MessageCircle, 
  Instagram, 
  MapPin, 
  Clock, 
  Phone, 
  CreditCard, 
  Wallet, 
  Banknote,
  Loader2,
  ExternalLink
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function EntrepreneurDetailView() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const [entrepreneur, setEntrepreneur] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, "emprendedores", id as string);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setEntrepreneur({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Cargando perfil...</p>
      </div>
    );
  }

  if (!entrepreneur) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="text-2xl font-bold text-primary">Emprendedor no encontrado</h1>
        <p className="text-muted-foreground">El perfil que buscas no existe o ha sido movido.</p>
        <Button onClick={() => router.push("/")} className="rounded-xl">
          Volver al Directorio
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* Botón Volver Flotante */}
      <div className="fixed top-4 left-4 z-50">
        <Button 
          variant="secondary" 
          size="icon" 
          onClick={() => router.push("/")}
          className="rounded-full shadow-lg bg-white/90 backdrop-blur-sm border-none"
        >
          <ArrowLeft className="w-5 h-5 text-primary" />
        </Button>
      </div>

      {/* Hero Header */}
      <div className="relative h-72 w-full">
        <Image
          src={entrepreneur.imagenUrl || `https://picsum.photos/seed/${entrepreneur.id}/800/600`}
          alt={entrepreneur.nombre}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <Badge className="mb-2 bg-accent text-accent-foreground border-none font-bold uppercase text-[10px]">
            {entrepreneur.rubro || "General"}
          </Badge>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {entrepreneur.nombre}
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-6 relative z-10">
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden mb-8">
          <CardContent className="p-8 space-y-6 bg-white">
            {/* Descripción */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-primary uppercase tracking-widest">Sobre el negocio</h2>
              <p className="text-muted-foreground leading-relaxed">
                {entrepreneur.descripcion || "Este emprendedor aún no ha añadido una descripción detallada."}
              </p>
            </div>

            {/* Información de contacto rápida */}
            <div className="grid grid-cols-1 gap-4 pt-2">
              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase">Ubicación</p>
                  <p className="text-sm font-medium">{entrepreneur.ubicacion || "Sector Central"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase">Horario</p>
                  <p className="text-sm font-medium">{entrepreneur.horario || "Consultar disponibilidad"}</p>
                </div>
              </div>
            </div>

            {/* Medios de Pago */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-bold text-primary uppercase tracking-widest">Medios de Pago</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col items-center gap-1.5 opacity-70">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-slate-600" />
                  </div>
                  <span className="text-[10px] font-bold">Efectivo</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 opacity-70">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-slate-600" />
                  </div>
                  <span className="text-[10px] font-bold">Tarjetas</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 opacity-70">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-slate-600" />
                  </div>
                  <span className="text-[10px] font-bold">Transferencia</span>
                </div>
              </div>
            </div>

            {/* Redes y Contacto */}
            <div className="space-y-3 pt-4">
              <Button 
                className="w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-lg gap-3 shadow-lg shadow-[#25D366]/20"
                onClick={() => window.open(`https://wa.me/${entrepreneur.whatsapp || entrepreneur.contacto}`, '_blank')}
              >
                <MessageCircle className="w-6 h-6 fill-current" />
                WhatsApp
              </Button>
              
              {entrepreneur.instagram && (
                <Button 
                  variant="outline"
                  className="w-full h-14 rounded-2xl border-pink-500/20 text-pink-600 hover:bg-pink-50 font-bold text-lg gap-3"
                  onClick={() => window.open(`https://instagram.com/${entrepreneur.instagram}`, '_blank')}
                >
                  <Instagram className="w-6 h-6" />
                  Instagram
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground italic px-8">
          "Al comprar en este puesto, recuerda mostrar tu código QR para sumar sellos y ganar recompensas."
        </p>
      </div>
    </main>
  );
}
