
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot, collection, query, getDocs, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, Entrepreneur, PATIO_INFO } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Search, Loader2, QrCode, Gift, LogIn, UserPlus, Sparkles, Trophy, Instagram, Facebook, MapPin, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, isVendorVisible } from "@/lib/utils";
import { UserProfile } from "@/components/profile/UserProfile";
import { RewardsTab } from "@/components/profile/RewardsTab";
import { RecommendationWidget } from "@/components/ai/RecommendationWidget";
import { Auth } from "@/components/Auth";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { useToast } from "@/hooks/use-toast";
import { useLocation, LOCATIONS } from "@/context/LocationContext";

export default function Home() {
  const [activeTab, setActiveTab] = useState("directory");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const { selectedLocation, setSelectedLocation } = useLocation();
  const { toast } = useToast();
  const router = useRouter();
  const [premiosBadge, setPremiosBadge] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [entrepreneurs, setEntrepreneurs] = useState<Entrepreneur[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugGps, setDebugGps] = useState<{ lat: number; lng: number; zona: string; dist: string; server?: string } | null>(null);
  const lastGeoApiCallRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === "true" || params.get("register") === "true") {
        setShowAuth(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    const userRef = doc(db, "usuarios", user.uid);
    const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });

    return () => unsubscribeDoc();
  }, [user]);

  // Badge de premios — se activa cuando el usuario tiene sellos suficientes para canjear algo
  useEffect(() => {
    const stampsCount = userData?.comprasRealizadas || 0;
    if (!userData || stampsCount === 0) {
      setPremiosBadge(false);
      return;
    }
    getDocs(query(collection(db, "premios"), where("activo", "==", true)))
      .then((snap) => {
        const puedeCanejear = snap.docs.some((d) => {
          const s = d.data().sellosRequeridos;
          return typeof s === "number" && stampsCount >= s;
        });
        setPremiosBadge(puedeCanejear);
      })
      .catch(() => {});
  }, [userData]);

  // Listener en tiempo real para el directorio de emprendedores
  useEffect(() => {
    const q = query(collection(db, "entrepreneur_profiles"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.businessName || data.nombre || "Local Aliado",
          category: data.category || data.rubro || "all",
          description: data.description || "",
          imageUrl: data.imageUrls?.[0] || data.imagenUrl || "/Logo3.png",
          contact: data.whatsapp || data.contactPhone || "",
          schedule: data.operatingHours || data.horario || "",
          locationId: data.ubicacionTienda || "loc-1",
          // Campos Premium (quedan undefined si el local no los tiene)
          imagenTarjeta: data.imagenTarjeta || undefined,
          imagenPerfil: data.imagenPerfil || undefined,
          logoHeader: data.logoHeader || undefined,
          isPremium: data.isPremium === true || undefined,
        } as Entrepreneur;
      });
      
      setEntrepreneurs(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando directorio:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // FIX: usar ref para userData — evita que el efecto se reinicie en cada snapshot
  const userDataRef = useRef<any>(null);
  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  // Ref para acceder al usuario actual sin cerrar sobre él (evita stale closures)
  const userRef = useRef<typeof user>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Throttle: llamar a la API máximo 1 vez cada 2 minutos
  const API_THROTTLE_MS = 2 * 60 * 1000;

  const handleGeolocationPosition = useCallback(async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    setDebugGps(prev => ({
      lat: latitude,
      lng: longitude,
      zona: prev?.zona ?? "Consultando…",
      dist: prev?.dist ?? "",
      server: "⏳ consultando…",
    }));

    if (Date.now() - lastGeoApiCallRef.current < API_THROTTLE_MS) return;
    lastGeoApiCallRef.current = Date.now();

    try {
      const res = await fetch("/api/check-geofence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid, latitude, longitude }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("[Geofence] Error del servidor:", data.error);
        setDebugGps(prev => prev ? { ...prev, server: `Error servidor ❌: ${data.error?.slice(0, 40)}` } : null);
        return;
      }

      const distStr = data.distances
        ? data.distances.map((d: any) => `${d.id}:${d.distance}m`).join("  ")
        : data.distance != null ? `${data.zone}:${data.distance}m` : "";

      let zonaLabel = "Fuera ❌";
      let serverLabel = "";

      if (data.triggered) {
        zonaLabel = `DENTRO ✅ (${data.zone})`;
        serverLabel = data.pushSent ? "Push enviado 🔔" : "Sin FCM token ⚠️";
        await dispararAlertaSistema(
          data.zone === "test" ? "¡Modo Pruebas Base Luna Labs! 🛰️" : "¡Estás cerca de Patio Curauma! 🛍️",
          data.zone === "test" ? "GPS detectado correctamente." : "Visítanos hoy y suma sellos."
        );
      } else if (data.reason === "cooldown") {
        zonaLabel = `DENTRO ✅ (${data.zone})`;
        serverLabel = "Cooldown activo ⏱";
      } else {
        serverLabel = "Sin zona activa";
      }

      setDebugGps({ lat: latitude, lng: longitude, zona: zonaLabel, dist: distStr, server: serverLabel });
    } catch (err) {
      console.error("[Geofence] Error API:", err);
      setDebugGps(prev => prev ? { ...prev, server: "Error API ❌" } : null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geolocalización en segundo plano — usa Capacitor en Android/iOS, watchPosition en web
  useBackgroundGeolocation({
    enabled: !!user,
    onPosition: handleGeolocationPosition,
    onError: (msg) => {
      console.warn("[Geofence] Error GPS:", msg);
      setDebugGps({ lat: 0, lng: 0, zona: `Error GPS ❌`, dist: msg, server: "" });
    },
    distanceFilter: 50,
  });

  const filteredEntrepreneurs = entrepreneurs.filter((e) => {
    // Visibility gate: exclude vendors with no real name or no real image.
    // Applied before category/search so incomplete profiles never appear publicly.
    if (!isVendorVisible(e)) return false;

    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderHero = () => (
    <section style={{
      background: "linear-gradient(135deg, #C9920A 0%, #8DC63F 50%, #5BB8D4 100%)",
      padding: "40px 20px 32px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      position: "relative",
    }}>
      <img
        src="/Logo3.png"
        alt="Patio Curauma"
        style={{ width: 110, height: "auto", marginBottom: 16, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
      />
      <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: 32, fontWeight: 700, color: "white", margin: "0 0 8px 0" }}>
        Club Patio <span style={{ color: "#FFD700" }}>Curauma</span>
      </h1>
      <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, margin: 0, letterSpacing: "0.5px" }}>
        Fidelización · Premios · Comunidad
      </p>
    </section>
  );

  const renderContent = () => {
    if (showAuth) {
      return (
        <div className="py-6 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Auth />
        </div>
      );
    }

    switch (activeTab) {
      case "directory":
        return (
          <div className="space-y-4 pb-6 bg-white">
            {renderHero()}

            {/* Saludo personalizado */}
            {user && userData && (
              <div className="px-6" style={{ marginTop: "24px", marginBottom: "12px" }}>
                <p className="text-sm font-medium text-slate-600">
                  Hola,{" "}
                  <span className="font-bold text-slate-800">{userData.nombre?.split(" ")[0] || "Club Member"}</span>
                  {" · "}
                  <span className="font-black" style={{ color: "#C9920A" }}>{userData.comprasRealizadas || 0}</span>
                  {" sellos · "}
                  <span className="font-black" style={{ color: "#C9920A" }}>{userData.ticketsSorteo || 0}</span>
                  {" tickets"}
                </p>
              </div>
            )}

            {/* Banner de ubicación — abre modal selector */}
            <button
              onClick={() => setShowLocationModal(true)}
              className="mx-6 flex items-center gap-2 w-[calc(100%-3rem)] text-left active:scale-[0.98] transition-transform"
              style={{ background: "#F0F9FF", border: "1px solid rgba(91,184,212,0.3)", borderRadius: "12px", padding: "8px 14px" }}
            >
              <MapPin className="w-4 h-4 shrink-0" style={{ color: "#5BB8D4" }} />
              <p className="font-bold flex-1 truncate" style={{ color: "#2C6B8A", fontSize: "13px" }}>
                {selectedLocation.address}
              </p>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#5BB8D4" }} />
            </button>

            {/* Acceso rápido a Premios */}
            <div
              onClick={() => router.push("/premios")}
              className="mx-6 active:scale-[0.97] transition-transform"
              style={{
                background: "linear-gradient(135deg, #C9920A 0%, #8DC63F 100%)",
                borderRadius: "16px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(201,146,10,0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "28px" }}>🎁</span>
                <div>
                  <p style={{ color: "white", fontWeight: 700, fontSize: "15px", margin: 0, fontFamily: "Montserrat, sans-serif" }}>
                    Mis Premios y Sellos
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "12px", margin: 0 }}>
                    Ver tarjeta · Canjear · Sorteo
                  </p>
                </div>
              </div>
              <span style={{ color: "white", fontSize: "20px" }}>›</span>
            </div>

            <div className="px-6">
              <RecommendationWidget />
            </div>

            {/* CTA Tienda Online — inmediatamente después de Destacados */}
            <div className="px-6" style={{ marginTop: "12px", marginBottom: "12px" }}>
              <a
                href="https://www.patiocuraumaonline.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full h-14 rounded-full font-black text-white text-base shadow-lg transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ backgroundColor: "#5BB8D4" }}
              >
                🛍️ Visita nuestra Tienda Online
              </a>
            </div>

            <section className="px-6 pt-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar emprendimientos..."
                  className="pl-11 h-12 rounded-xl bg-slate-50 border-none shadow-inner"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2 px-6 no-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-5 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all",
                      selectedCategory === cat.id
                        ? "bg-primary text-white border-transparent shadow-md border"
                        : "text-[#333333] hover:border-primary/50 hover:text-primary"
                    )}
                    style={selectedCategory !== cat.id ? { background: "#F5F5F5", border: "1.5px solid #BBBBBB" } : {}}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-6 px-6 pt-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-black text-foreground">Descubre</h2>
                <Badge variant="outline" className="rounded-md border-slate-100 font-bold text-[10px]">
                  {filteredEntrepreneurs.length} Locales
                </Badge>
              </div>
              
              {loading ? (
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-slate-100 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : filteredEntrepreneurs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs italic">
                  No se encontraron resultados en el directorio.
                </div>
              ) : (
                <>
                  {/* Primeras 4 tarjetas */}
                  <div className="grid grid-cols-2 gap-4">
                    {filteredEntrepreneurs.slice(0, 4).map((entrepreneur) => (
                      <div key={entrepreneur.id}>
                        <EntrepreneurCard entrepreneur={entrepreneur} />
                      </div>
                    ))}
                  </div>

                  {/* Resto de tarjetas */}
                  {filteredEntrepreneurs.length > 4 && (
                    <div className="grid grid-cols-2 gap-4">
                      {filteredEntrepreneurs.slice(4).map((entrepreneur, index, arr) => {
                        const isLast = index === arr.length - 1;
                        const isOdd = arr.length % 2 !== 0;
                        return (
                          <div key={entrepreneur.id} className={cn(isLast && isOdd ? "col-span-2" : "")}>
                            <EntrepreneurCard entrepreneur={entrepreneur} fullWidth={isLast && isOdd} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="px-6 py-12 text-center space-y-4 bg-slate-50 mt-10">
              <p style={{ fontSize: '12px', color: '#999999', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center', marginBottom: '12px' }}>Síguenos</p>
              <div className="flex justify-center gap-6">
                <button onClick={() => window.open(`https://instagram.com/${PATIO_INFO.instagram}`, '_blank')} className="text-pink-600 hover:scale-110 transition-transform">
                  <Instagram className="w-6 h-6" />
                </button>
                <button onClick={() => window.open(`https://facebook.com/${PATIO_INFO.facebook}`, '_blank')} className="text-blue-600 hover:scale-110 transition-transform">
                  <Facebook className="w-6 h-6" />
                </button>
                <button onClick={() => window.open(`https://www.tiktok.com/@${PATIO_INFO.tiktok}`, '_blank')} className="text-slate-800 hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
                  </svg>
                </button>
              </div>
            </section>
            
            <div className="h-24" />
          </div>
        );
      case "rewards":
        return <RewardsTab user={user} userData={userData} onShowAuth={() => setShowAuth(true)} />;
      case "profile":
        return <div className="pt-6 px-4 bg-white"><UserProfile onSwitchMode={() => {}} onShowAuth={() => setShowAuth(true)} /><div className="h-24" /></div>;
      default:
        return null;
    }
  };

  const isAdmin = user?.email?.toLowerCase().trim() === "ignaciiio.mate@gmail.com";

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto pb-4">
        {renderContent()}
      </div>
      <BottomNav activeTab={activeTab} premiosBadge={premiosBadge} onTabChange={(tab) => {
        setActiveTab(tab);
        setShowAuth(false);
      }} />

      {/* Modal selector de ubicación */}
      {showLocationModal && (
        <div
          className="fixed inset-0 z-[200] flex items-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowLocationModal(false)}
        >
          <div
            className="w-full bg-white rounded-t-[28px] pb-safe animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            <div className="px-6 pt-3 pb-8">
              <h2 className="text-lg font-black text-slate-800 mb-5">
                Selecciona tu ubicación
              </h2>

              <div className="space-y-2">
                {LOCATIONS.map((loc) => {
                  const isActive = loc.id === selectedLocation.id;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setShowLocationModal(false);
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                      style={{
                        background: isActive ? "#F0F9FF" : "#F8FAFC",
                        border: isActive ? "1.5px solid #5BB8D4" : "1.5px solid #F1F5F9",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: isActive ? "#5BB8D4" : "#E2E8F0" }}
                      >
                        <MapPin
                          className="w-4 h-4"
                          style={{ color: isActive ? "white" : "#94A3B8" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm leading-tight">
                          {loc.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {loc.address}
                        </p>
                      </div>
                      {isActive && (
                        <Check className="w-5 h-5 shrink-0" style={{ color: "#5BB8D4" }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowLocationModal(false)}
                className="w-full mt-4 h-12 rounded-2xl font-bold text-slate-400 text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel debug GPS — solo visible para admin */}
      {isAdmin && (
        <div style={{
          position: "fixed", bottom: "80px", left: "8px", right: "8px",
          background: "rgba(0,0,0,0.85)", borderRadius: "10px",
          padding: "10px 14px", zIndex: 9999, fontSize: "11px",
          color: "#fff", fontFamily: "monospace", lineHeight: "1.6",
          pointerEvents: "none",
        }}>
          <div style={{ color: "#facc15", fontWeight: "bold", marginBottom: "2px" }}>🛰 GPS Debug</div>
          {debugGps ? (
            <>
              <div>Lat: {debugGps.lat !== 0 ? debugGps.lat.toFixed(7) : "—"}</div>
              <div>Lng: {debugGps.lng !== 0 ? debugGps.lng.toFixed(7) : "—"}</div>
              {debugGps.dist && <div style={{ color: "#94a3b8" }}>{debugGps.dist}</div>}
              <div style={{ color: debugGps.zona.includes("✅") ? "#4ade80" : "#f87171", fontWeight: "bold" }}>
                {debugGps.zona}
              </div>
              {debugGps.server && (
                <div style={{ color: "#facc15", marginTop: "2px" }}>{debugGps.server}</div>
              )}
            </>
          ) : (
            <div style={{ color: "#94a3b8" }}>Esperando GPS…</div>
          )}
        </div>
      )}
    </main>
  );
}
