"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Ticket, Gift, Loader2, CheckCircle2, Clock, ArrowRight, XCircle, AlertCircle, Store } from "lucide-react";
import { canjearPremio } from "@/lib/puntos";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { updateDoc, doc, increment, collection, onSnapshot, where, query } from "firebase/firestore";

interface CatalogoPremiosProps {
  userId: string;
  userEmail?: string;
  comprasActuales: number;
}

interface CelebrationData {
  canjeId: string;
  codigo: string;
  premioNombre: string;
  premioIcono: string;
}

export function CatalogoPremios({ userId, userEmail, comprasActuales }: CatalogoPremiosProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [premios, setPremios] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [selectedPremio, setSelectedPremio] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Leer solo premios activos de la nueva colección
    const q = query(collection(db, "premios"), where("activo", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbPremios = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      dbPremios.sort((a, b) => (a.sellosRequeridos || 0) - (b.sellosRequeridos || 0));
      setPremios(dbPremios);
      setIsFetching(false);

      // vendorNombre ya viene en el documento, pero construir mapa por si acaso
      const map: Record<string, string> = {};
      dbPremios.forEach((p: any) => {
        if (p.vendorId && p.vendorNombre) map[p.vendorId] = p.vendorNombre;
      });
      setVendorNames(map);
    });
    return () => unsubscribe();
  }, []);

  const renderIcon = (icono: string, esSorteo: boolean) => {
    if (esSorteo) return <Ticket className="w-6 h-6" />;
    // Si el ícono es un emoji (1–2 caracteres unicode), renderizar directamente
    if (icono && icono.length <= 4 && /\p{Emoji}/u.test(icono)) {
      return <span className="text-2xl leading-none">{icono}</span>;
    }
    return <Gift className="w-6 h-6" />;
  };

  const handleCanje = async (premio: any) => {
    setSelectedPremio(null);
    setLoadingId(premio.id);
    try {
      if (premio.esSorteo) {
        // Sorteo: solo incrementa tickets, sin voucher
        const userRef = doc(db, "usuarios", userId);
        await updateDoc(userRef, {
          comprasRealizadas: increment(-(premio.sellosRequeridos || 0)),
          ticketsSorteo: increment(1),
        });
        toast({ title: "¡Ticket de Sorteo generado!", description: "Ya estás participando en el Gran Sorteo del Mes. 🎉" });
      } else {
        const userName = auth.currentUser?.displayName || "";
        const vendorNombre = premio.vendorNombre || vendorNames[premio.vendorId] || "Patio Curauma";
        const { canjeId, codigo } = await canjearPremio(db, userId, userName, {
          id: premio.id,
          nombre: premio.nombre,
          icono: premio.icono || "🎁",
          vendorId: premio.vendorId || "",
          vendorNombre,
          sellosRequeridos: premio.sellosRequeridos || 0,
        });
        setCelebration({ canjeId, codigo, premioNombre: premio.nombre, premioIcono: premio.icono || "🎁" });
      }
    } catch (error: any) {
      console.error("Error handleCanje:", error);
      toast({ variant: "destructive", title: "Error al canjear", description: error?.message || "No se pudo procesar el canje." });
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

          {/* Ícono del premio */}
          <div className="text-6xl drop-shadow-lg">{celebration.premioIcono}</div>

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
                  {celebration.codigo}
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
            onClick={() => router.push("/premios")}
            className="w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-2xl active:scale-[0.97] transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)" }}
          >
            Ver mis canjes activos <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <ShoppingBag className="w-5 h-5" />
          <h3 className="font-headline font-semibold text-lg">Catálogo de Beneficios</h3>
        </div>

        <div className="space-y-5">
          {isFetching ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : premios.length > 0 ? (
            (() => {
              // Agrupar premios por vendor
              const grupos: Record<string, { vendorName: string; items: any[] }> = {};
              premios.forEach((premio) => {
                const key = premio.vendorId || "__general__";
                const vendorName = premio.vendorNombre
                  || (premio.vendorId ? (vendorNames[premio.vendorId] || "Patio Curauma") : "Patio Curauma");
                if (!grupos[key]) grupos[key] = { vendorName, items: [] };
                grupos[key].items.push({ ...premio, vendorNombre: vendorName });
              });

              return Object.entries(grupos).map(([vendorKey, grupo]) => (
                <div key={vendorKey} className="space-y-2">
                  {/* Encabezado del local */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-primary truncate">
                      {grupo.vendorName}
                    </p>
                    <div className="flex-1 h-px bg-primary/15" />
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                      {grupo.items.length} {grupo.items.length === 1 ? "premio" : "premios"}
                    </span>
                  </div>

                  {/* Premios del local */}
                  <div className="grid grid-cols-1 gap-2">
                    {grupo.items.map((premio) => {
                      const costo = premio.sellosRequeridos || 0;
                      const sinStock = !premio.esSorteo && typeof premio.stock === "number" && premio.stock <= 0;
                      const puedeCanjear = comprasActuales >= costo && !sinStock;

                      return (
                        <Card
                          key={premio.id}
                          onClick={() => setSelectedPremio(premio)}
                          className={`overflow-hidden border transition-all duration-300 cursor-pointer active:scale-[0.98] ${premio.esSorteo ? 'border-yellow-300 bg-yellow-50/20' : 'border-slate-100'} ${sinStock ? 'opacity-50 grayscale' : puedeCanjear ? 'shadow-md hover:shadow-lg' : 'opacity-75'}`}
                        >
                          <CardContent className="p-4 flex items-center gap-3">
                            {/* Ícono */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${premio.esSorteo ? 'bg-yellow-400 text-white' : 'bg-primary/10 text-primary'}`}>
                              {renderIcon(premio.icono, premio.esSorteo)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-sm leading-tight ${premio.esSorteo ? 'text-yellow-700' : 'text-slate-800'}`}>
                                {premio.nombre}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p style={{ fontSize: "11px", color: "#9B9B9B" }}>
                                  {costo} sellos
                                </p>
                                {!premio.esSorteo && typeof premio.stock === "number" && (
                                  <p style={{ fontSize: "11px", fontWeight: 700, color: premio.stock <= 3 ? "#ef4444" : "#9B9B9B" }}>
                                    · {premio.stock === 0 ? "Sin stock" : `${premio.stock} disponibles`}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Badge */}
                            {puedeCanjear ? (
                              <span
                                style={{
                                  backgroundColor: premio.esSorteo ? "#EAB308" : "#8DC63F",
                                  color: "white",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  borderRadius: "20px",
                                  padding: "6px 14px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {premio.esSorteo ? "Ver" : "Ver premio"}
                              </span>
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
                    })}
                  </div>
                </div>
              ));
            })()
          ) : (
            <div className="flex flex-col items-center text-center py-10 px-4 space-y-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)" }}
              >
                <span style={{ fontSize: "32px", lineHeight: 1 }}>🎁</span>
              </div>
              <p className="text-base font-black text-slate-700">¡Próximamente!</p>
              <p className="text-sm text-slate-400 leading-relaxed max-w-[260px]">
                Nuevos premios y beneficios exclusivos se están preparando para ti.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles del premio */}
      {selectedPremio && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          onClick={() => setSelectedPremio(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

            {/* Cabecera */}
            <div className="px-7 pt-5 pb-4 flex justify-between items-start shrink-0">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-sm ${selectedPremio.esSorteo ? "bg-yellow-400" : "bg-primary/10"}`}>
                {selectedPremio.icono || "🎁"}
              </div>
              <button
                onClick={() => setSelectedPremio(null)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido scrolleable */}
            <div className="px-7 overflow-y-auto space-y-5 flex-1 pb-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedPremio.nombre}</h2>
                <p className="text-sm text-primary font-bold">{selectedPremio.sellosRequeridos} sellos requeridos</p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Descripción</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {selectedPremio.descripcion || "Este premio no tiene una descripción detallada, pero te aseguramos que es genial."}
                </p>
              </div>

              {typeof selectedPremio.stock === "number" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500">
                    Stock disponible:{" "}
                    <span style={{ color: selectedPremio.stock <= 3 ? "#ef4444" : "#1e293b" }}>
                      {selectedPremio.stock === 0 ? "Sin stock" : `${selectedPremio.stock} unidades`}
                    </span>
                  </p>
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dónde canjearlo</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                    <Store className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{selectedPremio.vendorNombre || "Patio Curauma"}</p>
                    <p className="text-xs text-slate-500">Local Adherido</p>
                  </div>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <p>Dirígete a <strong>{selectedPremio.vendorNombre || "la administración"}</strong> y muestra el código que se generará al confirmar el canje.</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-7 py-5 shrink-0 border-t border-slate-100 bg-white">
              {(() => {
                const sinStock = !selectedPremio.esSorteo && typeof selectedPremio.stock === "number" && selectedPremio.stock <= 0;
                const puedeCanjear = comprasActuales >= selectedPremio.sellosRequeridos && !sinStock;
                if (puedeCanjear) {
                  return (
                    <button
                      disabled={loadingId !== null}
                      onClick={() => handleCanje(selectedPremio)}
                      className="w-full h-14 rounded-2xl font-black text-base text-white shadow-lg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ backgroundColor: selectedPremio.esSorteo ? "#EAB308" : "#9DCC65" }}
                    >
                      {loadingId === selectedPremio.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        selectedPremio.esSorteo ? "Participar en el sorteo" : "Canjear Premio"
                      )}
                    </button>
                  );
                }
                return (
                  <div className="w-full p-4 rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-center border border-slate-200">
                    <p className="text-sm font-bold text-slate-500">Te faltan {selectedPremio.sellosRequeridos - comprasActuales} sellos</p>
                    <p className="text-xs text-slate-400">Sigue comprando para acumular más sellos.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
