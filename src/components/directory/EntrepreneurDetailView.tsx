
"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Share2,
  Heart
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function DetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Soporta tanto /emprendedor/[id] como /detalle?id=...
  const id = params?.id || searchParams.get('id');
  
  const [entrepreneur, setEntrepreneur] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, "entrepreneur_profiles", id as string);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEntrepreneur({ 
          id: docSnap.id, 
          nombre: data.businessName || data.nombre || "Local del Patio",
          descripcion: data.description || data.descripcion || "Sin descripción disponible.",
          rubro: data.category || data.rubro || "General",
          imagenUrl: data.imageUrls?.[0] || data.imagenUrl || `https://picsum.photos/seed/${docSnap.id}/800/600`,
          whatsapp: data.whatsapp || data.contactPhone || "",
          instagram: data.instagram || "",
          ubicacion: data.address || data.ubicacionTienda || "Patio Curauma",
          horario: data.operatingHours || data.horario || "Consultar en local",
          ...data 
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error cargando detalle:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: entrepreneur?.nombre,
        text: `¡Mira este emprendimiento en Club Patio Curauma!`,
        url: window.location.href,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F2F4F0]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-primary/60 font-bold uppercase text-[10px] tracking-widest">Cargando experiencia...</p>
      </div>
    );
  }

  if (!entrepreneur) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[#F2F4F0]">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
          <MapPin className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">Local no encontrado</h1>
        <Button onClick={() => router.push("/")} className="rounded-xl bg-primary">
          Volver al Directorio
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F4F0] pb-24 font-body animate-in fade-in duration-500">
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
        <Button 
          variant="secondary" 
          size="icon" 
          onClick={() => router.push("/")}
          className="rounded-full shadow-xl bg-white/90 backdrop-blur-md border-none"
        >
          <ArrowLeft className="w-5 h-5 text-primary" />
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={() => setIsFavorite(!isFavorite)}
            className="rounded-full shadow-xl bg-white/90 backdrop-blur-md border-none"
          >
            <Heart className={cn("w-5 h-5 transition-colors", isFavorite ? "fill-red-500 text-red-500" : "text-slate-400")} />
          </Button>
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={handleShare}
            className="rounded-full shadow-xl bg-white/90 backdrop-blur-md border-none"
          >
            <Share2 className="w-5 h-5 text-slate-400" />
          </Button>
        </div>
      </div>

      <div className="relative h-[45vh] w-full bg-slate-200">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-300 animate-pulse z-0" />
        )}
        <Image
          src={entrepreneur.imagenUrl}
          alt={entrepreneur.nombre}
          fill
          className={cn("object-cover z-10 transition-opacity duration-700", imageLoaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setImageLoaded(true)}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F2F4F0] via-transparent to-black/20 z-20" />
      </div>

      <div className="max-w-lg mx-auto px-6 -mt-16 relative z-10">
        <div className="space-y-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-8 space-y-4">
              <div className="space-y-2">
                <Badge className="bg-accent text-accent-foreground border-none font-black uppercase text-[9px] tracking-widest px-3">
                  {entrepreneur.rubro}
                </Badge>
                <h1 className="text-3xl font-black text-slate-800 tracking-tighter leading-none">
                  {entrepreneur.nombre}
                </h1>
              </div>

              <p className="text-slate-500 text-sm leading-relaxed font-medium italic">
                "{entrepreneur.descripcion}"
              </p>

              <Separator className="bg-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Sector</p>
                    <p className="text-xs font-bold text-slate-700">{entrepreneur.ubicacion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Horario</p>
                    <p className="text-xs font-bold text-slate-700">{entrepreneur.horario}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-3 px-2">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aceptamos</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {[
                { icon: Banknote, label: "Efectivo" },
                { icon: CreditCard, label: "Débito/Crédito" },
                { icon: Wallet, label: "Transferencia" }
              ].map((pay, i) => (
                <div key={i} className="bg-white px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm border border-slate-100 min-w-[140px]">
                  <pay.icon className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">{pay.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-3">
            <Button 
              className="w-full h-16 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-lg gap-4 shadow-xl shadow-[#25D366]/20 transition-all active:scale-95"
              onClick={() => window.open(`https://wa.me/${entrepreneur.whatsapp?.replace(/\D/g, '')}`, '_blank')}
            >
              <MessageCircle className="w-7 h-7 fill-current" />
              Contactar por WhatsApp
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline"
                className="h-14 rounded-2xl border-primary/20 bg-white text-primary font-bold gap-3 hover:bg-primary/5"
                onClick={() => window.open(`https://instagram.com/${entrepreneur.instagram?.replace('@', '')}`, '_blank')}
                disabled={!entrepreneur.instagram}
              >
                <Instagram className="w-5 h-5" />
                Instagram
              </Button>
              <Button 
                variant="outline"
                className="h-14 rounded-2xl border-primary/20 bg-white text-primary font-bold gap-3 hover:bg-primary/5"
                onClick={() => router.push("/map")}
              >
                <MapPin className="w-5 h-5" />
                Ver Mapa
              </Button>
            </div>
          </div>

          <Card className="bg-primary border-none rounded-3xl overflow-hidden shadow-lg">
            <CardContent className="p-6 flex items-center gap-4 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Heart className="w-6 h-6 fill-white" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-black uppercase tracking-widest opacity-80">Gana Recompensas</p>
                <p className="text-sm font-bold">Muestra tu QR al pagar en este local para sumar sellos.</p>
              </div>
            </CardContent>
          </Card>

          <footer className="text-center pt-4 pb-8">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              Toda la información ha sido proporcionada<br/>por el emprendedor de Patio Curauma.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

export function EntrepreneurDetailView() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <DetailContent />
    </Suspense>
  );
}
