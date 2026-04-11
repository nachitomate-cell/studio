"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Ticket, Gift, Coffee, Pizza, Sparkles, Star, Loader2, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { canjearRecompensa } from "@/lib/puntos";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { updateDoc, doc, increment, collection, onSnapshot, getDoc } from "firebase/firestore";

interface CatalogoPremiosProps {
  userId: string;
  userEmail?: string;
  comprasActuales: number;
}

interface CelebrationData {
  canjeId: string;
  codigoVoucher: string;
  premioNombre: string;
}

export function CatalogoPremios({ userId, userEmail, comprasActuales }: CatalogoPremiosProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [premios, setPremios] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
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

      // Cargar nombres de locales para display
      const vendorIds = [...new Set(dbPremios.map((p: any) => p.vendorId).filter(Boolean))] as string[];
      if (vendorIds.length > 0) {
        Promise.all(
          vendorIds.map(vid =>
            getDoc(doc(db, "entrepreneur_profiles", vid))
              .then(snap => ({ [vid]: snap.exists() ? (snap.data().businessName || snap.data().nombre || "Local Aliado") : "Local Aliado" }))
              .catch(() => ({ [vid]: "Local Aliado" }))
          )
        ).then(results => setVendorNames(Object.assign({}, ...results)));
      }
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
        // 4º arg = premioNombre (nombre del premio), 5º arg = userEmail
        const { canjeId, codigoVoucher } = await canjearRecompensa(
          db,
          userId,
          premio.sellos_requeridos || 0,
          premio.nombre,
          userEmail
        );
        setCelebration({ canjeId, codigoVoucher, premioNombre: premio.nombre });
      }
    } catch (error: any) {
      console.error("Error handleCanje:", error);
      toast({
        variant: "destructive",
        title: "Error al canjear",
        description: error?.message || "No se pudo procesar el canje.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  if (celebration) {
    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-6 text-white overflow-hidden"
        style={{ background: "linear-gradient(135deg, #D3B673 0%, #B8974A 40%, #9DCC65 100%)" }}
      >
        {/* Ondas animadas de fondo */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/10"
              style={{
                width: `${180 + i * 90}px`,
                height: `${180 + i * 90}px`,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                animation: `ping ${1.8 + i * 0.4}s cubic-bezier(0,0,0.2,1) infinite`,
                animationDelay: `${i * 0.35}s`,
                opacity: 0.12,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-6 text-center">
          {/* Ícono */}
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-28 w-28 rounded-full bg-white/20 animate-ping" />
            <div className="relative bg-white rounded-full p-5 shadow-2xl">
              <CheckCircle2 className="w-16 h-16" style={{ color: "#D3B673" }} strokeWidth={2} />
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight drop-shadow-lg">¡Premio canjeado!</h1>
            <p className="text-white/80 font-semibold text-lg">{celebration.premioNombre}</p>
          </div>

          {/* Card con código */}
          <div className="w-full bg-white/15 backdrop-blur-xl rounded-3xl border border-white/25 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
                  Tu código único
                </p>
                <p className="text-3xl font-black tracking-[0.15em] drop-shadow">
                  {celebration.codigoVoucher}
                </p>
              </div>

              <div className="h-px bg-white/15" />

              <div className="flex items-center justify-center gap-2 text-white/70">
                <Clock className="w-4 h-4 shrink-0" />
                <p className="text-xs font-bold">Válido por 48 horas · Muéstralo en caja</p>
              </div>
            </div>
          </div>

          {/* Botón */}
          <button
            onClick={() => router.push(`/canje/${celebration.canjeId}`)}
            className="w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-2xl active:scale-[0.97] transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)" }}
          >
            Ver mi ticket completo <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <ShoppingBag className="w-5 h-5" />
        <h3 className="font-headline font-semibold text-lg">Catálogo de Beneficios</h3>
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
            
            const vendorName = premio.vendorId
              ? (vendorNames[premio.vendorId] || "Patio Curauma")
              : "Patio Curauma";

            return (
              <Card
                key={premio.id}
                className={`overflow-hidden border transition-all duration-300 ${premio.esSorteo ? 'border-yellow-300 bg-yellow-50/20' : 'border-slate-100'} ${puedeCanjear ? 'shadow-md' : 'opacity-75'}`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  {/* Ícono */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${premio.esSorteo ? 'bg-yellow-400 text-white' : 'bg-accent/10 text-primary'}`}>
                    {renderIcon(premio.icono, premio.esSorteo)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm leading-tight ${premio.esSorteo ? 'text-yellow-700' : 'text-slate-800'}`}>
                      {premio.nombre}
                    </p>
                    <p style={{ fontSize: "12px", color: "#6B6B6B", marginTop: "2px" }} className="truncate">
                      {vendorName}
                    </p>
                    <p style={{ fontSize: "11px", color: "#9B9B9B", marginTop: "2px" }}>
                      Valor: {costo} sellos
                    </p>
                  </div>

                  {/* Badge de estado / acción */}
                  {puedeCanjear ? (
                    <button
                      disabled={loadingId !== null}
                      onClick={() => handleCanje(premio)}
                      style={{
                        backgroundColor: premio.esSorteo ? "#EAB308" : "#8DC63F",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: 700,
                        borderRadius: "20px",
                        padding: "6px 14px",
                        whiteSpace: "nowrap",
                        opacity: loadingId !== null ? 0.6 : 1,
                        cursor: loadingId !== null ? "not-allowed" : "pointer",
                      }}
                    >
                      {loadingId === premio.id ? "..." : premio.esSorteo ? "Participar" : "¡Canjear!"}
                    </button>
                  ) : (
                    <span
                      style={{
                        backgroundColor: "rgba(201,146,10,0.12)",
                        color: "#C9920A",
                        fontSize: "12px",
                        fontWeight: 700,
                        borderRadius: "20px",
                        padding: "6px 14px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Faltan {costo - comprasActuales}
                    </span>
                  )}
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
