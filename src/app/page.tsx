
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot, collection, query, getDocs, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, Entrepreneur, PATIO_INFO } from "@/lib/data";
import { useUserLocation, haversineKm } from "@/hooks/useUserLocation";
import { isOpenNow } from "@/lib/horarios";
import { Input } from "@/components/ui/input";
import { Search, Loader2, QrCode, Gift, LogIn, UserPlus, Sparkles, Trophy, Instagram, Facebook, MapPin, ChevronDown, Check, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, isVendorVisible } from "@/lib/utils";
import { UserProfile } from "@/components/profile/UserProfile";
import { RewardsTab } from "@/components/profile/RewardsTab";
import { RecommendationWidget } from "@/components/ai/RecommendationWidget";
import { AIAssistantModal } from "@/components/ai/AIAssistantModal";
import { Auth } from "@/components/Auth";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { useToast } from "@/hooks/use-toast";
import { useLocation, LOCATIONS } from "@/context/LocationContext";

import { ADMIN_EMAIL } from "@/lib/constants";

export default function Home() {
  const [activeTab, setActiveTab] = useState("directory");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const onboardingCheckedRef = useRef(false);
  const { selectedLocation, setSelectedLocation } = useLocation();
  const { toast } = useToast();
  const router = useRouter();
  const [premiosBadge, setPremiosBadge] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [entrepreneurs, setEntrepreneurs] = useState<Entrepreneur[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAbierto, setFilterAbierto] = useState(false);
  const [filterCercano, setFilterCercano] = useState(false);
  const [filterFavoritos, setFilterFavoritos] = useState(false);
  const { coords: userCoords, loading: locLoading, denied: locDenied, request: requestLocation } = useUserLocation();
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
      const ref = params.get("ref");
      if (ref) localStorage.setItem("referral_local_id", ref);
      if (params.get("login") === "true" || params.get("register") === "true") {
        setShowAuth(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      onboardingCheckedRef.current = false;
      return;
    }

    const userRef = doc(db, "usuarios", user.uid);
    const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });

    return () => unsubscribeDoc();
  }, [user]);

  // Show onboarding tutorial once per new client account
  useEffect(() => {
    if (!user || !userData || onboardingCheckedRef.current) return;
    onboardingCheckedRef.current = true;

    const email = (user.email ?? "").toLowerCase().trim();
    const isAdmin = email === ADMIN_EMAIL;
    const isVendor = Array.isArray(userData.roles)
      ? userData.roles.includes("emprendedor")
      : userData.rol === "emprendedor";

    if (!isAdmin && !isVendor && !userData.hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, [user, userData]);

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
          imageUrl: data.imageUrls?.[0] || data.imagenUrl || "/Logo2.png",
          contact: data.whatsapp || data.contactPhone || "",
          schedule: data.operatingHours || data.horario || "",
          locationId: data.ubicacionTienda || "loc-1",
          // Campos Premium (quedan undefined si el local no los tiene)
          imagenTarjeta: data.imagenTarjeta || undefined,
          imagenPerfil: data.imagenPerfil || undefined,
          logoHeader: data.logoHeader || undefined,
          isPremium: data.isPremium === true || undefined,
          isHiddenFromFeed: data.isHiddenFromFeed === true,
          horariosEstructurados: data.horariosEstructurados || null,
          lat: data.lat || null,
          lng: data.lng || null,
        } as Entrepreneur & { isHiddenFromFeed?: boolean };
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

  // Normaliza acentos y mayúsculas para búsqueda tolerante
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const searchNorm = normalize(searchQuery);
  const searchTokens = searchNorm.split(/\s+/).filter(Boolean);

  let result = entrepreneurs.filter((e: any) => {
    // Visibility gate: exclude vendors with no real name or no real image.
    // Applied before category/search so incomplete profiles never appear publicly.
    if (!isVendorVisible(e)) return false;

    // Hub & Spoke: Ocultar tiendas "hijas" del feed principal
    // Pero permitir que sean encontradas si el usuario usa el buscador superior
    if (e.isHiddenFromFeed && !searchQuery) return false;

    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;

    // Búsqueda tolerante: sin acentos, por tokens, sobre nombre + descripción + categoría
    const haystack = normalize(`${e.name} ${e.description} ${e.category ?? ""}`);
    const matchesSearch = searchTokens.length === 0 || searchTokens.every((t) => haystack.includes(t));

    if (!matchesCategory || !matchesSearch) return false;

    if (filterAbierto) {
      const open = isOpenNow((e as any).horariosEstructurados);
      if (open !== true) return false;
    }

    if (filterFavoritos) {
      const favoritos: string[] = Array.isArray(userData?.favoritos) ? userData.favoritos : [];
      if (!favoritos.includes(e.id)) return false;
    }

    return true;
  });

  if (filterCercano && userCoords) {
    const MALL_LAT = PATIO_INFO.coordinates.lat;
    const MALL_LNG = PATIO_INFO.coordinates.lng;
    result = [...result].sort((a: any, b: any) => {
      const dA = haversineKm(userCoords.lat, userCoords.lng, a.lat ?? MALL_LAT, a.lng ?? MALL_LNG);
      const dB = haversineKm(userCoords.lat, userCoords.lng, b.lat ?? MALL_LAT, b.lng ?? MALL_LNG);
      return dA - dB;
    });
  }

  const filteredEntrepreneurs = result;

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
      <div style={{ position: "relative", width: 110, marginBottom: 16 }}>
        <img
          src="/Logo3.webp"
          alt="Patio Curauma"
          style={{ width: 110, height: "auto", display: "block", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
        />
        <div style={{
          position: "absolute",
          bottom: -6,
          left: "10%",
          right: "10%",
          height: 14,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, transparent 70%)",
          filter: "blur(4px)",
        }} />
      </div>
      <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: 24, fontWeight: 900, color: "white", margin: "0 0 8px 0", lineHeight: 1.1, letterSpacing: "1px" }}>
        CLUB<br/>
        <span style={{ color: "#FFD700", fontSize: 32, fontWeight: 900, textShadow: "0 2px 6px rgba(0,0,0,0.35)" }}>PATIO CURAUMA</span>
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
              <div className="px-6 flex items-center justify-between" style={{ marginTop: "24px", marginBottom: "12px" }}>
                <p className="text-sm font-medium text-slate-600">
                  Hola,{" "}
                  <span className="font-bold text-slate-800">{userData.nombre?.split(" ")[0] || "Club Member"}</span>
                  {" · "}
                  <span className="font-black" style={{ color: "#C9920A" }}>{userData.comprasRealizadas || 0}</span>
                  {" sellos · "}
                  <span className="font-black" style={{ color: "#C9920A" }}>{userData.ticketsSorteo || 0}</span>
                  {" tickets"}
                </p>
                <button
                  onClick={() => setShowAIModal(true)}
                  className="flex items-center gap-1 shrink-0 ml-3 px-2.5 py-1 rounded-full transition-all active:scale-90"
                  style={{
                    background: "linear-gradient(135deg, #6D28D9 0%, #0EA5E9 100%)",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "white",
                  }}
                  aria-label="Abrir Asistente IA"
                >
                  <Sparkles className="w-3 h-3" />
                  IA
                </button>
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
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#C9920A" }} />
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
                  className="pl-11 h-12 rounded-xl bg-slate-50 border-none shadow-inner placeholder:text-gray-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-3">
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
                    style={selectedCategory !== cat.id ? { background: "#F5F5F5", border: "1px solid #E5E7EB" } : {}}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Filtro favoritos — solo visible si el usuario está logueado */}
              {user && (
                <div className="px-6">
                  <button
                    onClick={() => setFilterFavoritos((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border",
                      filterFavoritos
                        ? "text-white border-transparent shadow"
                        : "bg-white text-slate-500 border-slate-200"
                    )}
                    style={filterFavoritos ? { background: "#C9920A", borderColor: "#C9920A" } : {}}
                  >
                    <Heart className={cn("w-3.5 h-3.5", filterFavoritos ? "fill-white text-white" : "text-slate-400")} />
                    Mis Favoritos
                    {filterFavoritos && Array.isArray(userData?.favoritos) && userData.favoritos.length > 0 && (
                      <span className="ml-0.5 bg-white/25 rounded-full px-1.5 py-0.5 text-[9px] font-black">
                        {userData.favoritos.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
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
                    {filteredEntrepreneurs.slice(0, 4).map((entrepreneur, idx) => {
                      const isOpen = isOpenNow((entrepreneur as any).horariosEstructurados);
                      const distKm = userCoords ? haversineKm(userCoords.lat, userCoords.lng, (entrepreneur as any).lat ?? PATIO_INFO.coordinates.lat, (entrepreneur as any).lng ?? PATIO_INFO.coordinates.lng) : undefined;
                      return (
                        <div key={entrepreneur.id}>
                          <EntrepreneurCard entrepreneur={entrepreneur} isOpen={isOpen} distanceKm={filterCercano && distKm !== undefined ? distKm : undefined} priority={idx < 2} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Resto de tarjetas */}
                  {filteredEntrepreneurs.length > 4 && (
                    <div className="grid grid-cols-2 gap-4">
                      {filteredEntrepreneurs.slice(4).map((entrepreneur, index, arr) => {
                        const isLast = index === arr.length - 1;
                        const isOdd = arr.length % 2 !== 0;
                        const isOpen = isOpenNow((entrepreneur as any).horariosEstructurados);
                        const distKm = userCoords ? haversineKm(userCoords.lat, userCoords.lng, (entrepreneur as any).lat ?? PATIO_INFO.coordinates.lat, (entrepreneur as any).lng ?? PATIO_INFO.coordinates.lng) : undefined;
                        return (
                          <div key={entrepreneur.id} className={cn(isLast && isOdd ? "col-span-2" : "")}>
                            <EntrepreneurCard entrepreneur={entrepreneur} fullWidth={isLast && isOdd} isOpen={isOpen} distanceKm={filterCercano && distKm !== undefined ? distKm : undefined} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            <section
              className="mx-6 mt-10 mb-2 rounded-3xl overflow-hidden"
              style={{ background: "linear-gradient(135deg, #C9920A 0%, #8DC63F 55%, #5BB8D4 100%)" }}
            >
              {/* Header con logo */}
              <div className="px-6 pt-6 pb-4 flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)" }}
                >
                  <img src="/Logo3.webp" alt="Patio Curauma" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[3px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Club Patio Curauma
                  </p>
                  <h3 className="text-lg font-black text-white leading-tight">
                    Síguenos en redes
                  </h3>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.8)" }}>
                    Novedades y promociones
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-5" style={{ height: 1, background: "rgba(255,255,255,0.25)" }} />

              {/* Social buttons */}
              <div className="flex gap-3 px-5 py-5">
                {/* Instagram */}
                <button
                  onClick={() => window.open(`https://instagram.com/${PATIO_INFO.instagram}`, '_blank')}
                  className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.35)" }}
                >
                  <Instagram className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-black text-white uppercase tracking-wide">Instagram</span>
                </button>

                {/* Facebook */}
                <button
                  onClick={() => window.open(`https://facebook.com/${PATIO_INFO.facebook}`, '_blank')}
                  className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.35)" }}
                >
                  <Facebook className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-black text-white uppercase tracking-wide">Facebook</span>
                </button>

                {/* TikTok */}
                <button
                  onClick={() => window.open(`https://www.tiktok.com/@${PATIO_INFO.tiktok}`, '_blank')}
                  className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.35)" }}
                >
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
                  </svg>
                  <span className="text-[9px] font-black text-white uppercase tracking-wide">TikTok</span>
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

  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL;

  return (
    <main className="min-h-screen bg-white">
      {showOnboarding && user && (
        <OnboardingTutorial
          userId={user.uid}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <div className="max-w-lg mx-auto pb-4">
        {renderContent()}
      </div>
      <PWAInstallBanner userId={user?.uid ?? null} />
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

      <AIAssistantModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        userData={userData}
      />

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
