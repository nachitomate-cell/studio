
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
import { Search, Loader2, QrCode, Gift, LogIn, UserPlus, Sparkles, Trophy, Instagram, Facebook, MapPin, ChevronDown, Check, Heart, X, ExternalLink } from "lucide-react";
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
import { NpsSurvey } from "@/components/NpsSurvey";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { useBackgroundGeolocation } from "@/hooks/useBackgroundGeolocation";
import { useToast } from "@/hooks/use-toast";
import { useLocation, LOCATIONS } from "@/context/LocationContext";

import { ADMIN_EMAIL } from "@/lib/constants";
import { captureUTMParams, registrarVisitaUTM } from "@/lib/utmTracking";
import VendorStampModal from "@/components/VendorStampModal";
import QRCode from "react-qr-code";

function getMondayKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function calcularStreak(logs: { fecha?: string; anulada?: boolean }[]): number {
  const weeks = new Set<string>();
  for (const log of logs) {
    if (log.anulada || !log.fecha) continue;
    weeks.add(getMondayKey(new Date(log.fecha)));
  }
  if (weeks.size === 0) return 0;

  let streak = 0;
  const check = new Date();
  check.setDate(check.getDate() - (check.getDay() === 0 ? 6 : check.getDay() - 1));

  if (!weeks.has(check.toISOString().slice(0, 10))) {
    check.setDate(check.getDate() - 7);
    if (!weeks.has(check.toISOString().slice(0, 10))) return 0;
  }
  while (weeks.has(check.toISOString().slice(0, 10))) {
    streak++;
    check.setDate(check.getDate() - 7);
  }
  return streak;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("directory");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const redirectAfterLoginRef = useRef<string | null>(null);
  const [pushNotif, setPushNotif] = useState<{ titulo: string; body: string; tipo: string; cta: string } | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showNpsSurvey, setShowNpsSurvey] = useState(false);
  const onboardingCheckedRef = useRef(false);
  const npsCheckedRef = useRef(false);
  const { selectedLocation, setSelectedLocation } = useLocation();
  const { toast } = useToast();
  const router = useRouter();
  const [premiosBadge, setPremiosBadge] = useState(false);
  const [nextPremio, setNextPremio] = useState<{ nombre: string; sellosRequeridos: number; icono: string } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [publicidad, setPublicidad] = useState<{ imageUrl: string; cta: string | null } | null>(null);
  const [showPublicidad, setShowPublicidad] = useState(false);
  const [publicidadLoading, setPublicidadLoading] = useState(() =>
    typeof window !== "undefined" ? !sessionStorage.getItem("publicidad_vista") : false
  );
  const [streak, setStreak] = useState(0);
  const [ofertasHoy, setOfertasHoy] = useState<any[]>([]);
  
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
    sessionStorage.setItem('home_visited', '1');
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && redirectAfterLoginRef.current) {
        router.replace(redirectAfterLoginRef.current);
        redirectAfterLoginRef.current = null;
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) localStorage.setItem("referral_local_id", ref);
      const utm = captureUTMParams();
      if (utm) registrarVisitaUTM(utm, auth.currentUser?.uid);
      if (params.get("login") === "true" || params.get("register") === "true") {
        setShowAuth(true);
      }
      const redirectParam = params.get("redirect");
      if (redirectParam) {
        redirectAfterLoginRef.current = redirectParam;
        setShowAuth(true);
      }
      const nt = params.get("n_t");
      const nb = params.get("n_b");
      if (nt && nb) {
        setPushNotif({
          titulo: nt,
          body: nb,
          tipo: params.get("n_tipo") || "",
          cta: params.get("n_cta") || "/",
        });
        window.history.replaceState({}, "", "/");
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "publicidad"), (snap) => {
      if (snap.exists() && snap.data().activa && snap.data().imageUrl) {
        const d = snap.data();
        setPublicidad({ imageUrl: d.imageUrl, cta: d.cta || null });
        if (!sessionStorage.getItem("publicidad_vista")) {
          sessionStorage.setItem("publicidad_vista", "1");
          setShowPublicidad(true);
        }
      } else {
        setPublicidad(null);
        setShowPublicidad(false);
      }
      setPublicidadLoading(false);
    });
    return () => unsub();
  }, []);

  // Streak: consulta one-shot al cambiar el usuario
  useEffect(() => {
    if (!user) { setStreak(0); return; }
    getDocs(query(
      collection(db, "system_logs"),
      where("usuarioId", "==", user.uid),
      where("tipo", "==", "FIDELIZACION")
    )).then(snap => {
      setStreak(calcularStreak(snap.docs.map(d => d.data())));
    }).catch(() => setStreak(0));
  }, [user]);

  // Ofertas del día: listener en tiempo real
  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const unsub = onSnapshot(
      query(collection(db, "ofertas_dia"), where("fechaISO", "==", hoy), where("activa", "==", true)),
      (snap) => setOfertasHoy(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
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

  // Show NPS survey 30 days after registration if not yet answered
  useEffect(() => {
    if (!user || !userData || npsCheckedRef.current) return;
    if (userData.nps) return;
    if (!userData.createdAt) return;
    const daysSince = (Date.now() - new Date(userData.createdAt).getTime()) / 86_400_000;
    if (daysSince >= 30) {
      npsCheckedRef.current = true;
      setShowNpsSurvey(true);
    }
  }, [user, userData]);

  // Badge de premios + próximo premio alcanzable
  useEffect(() => {
    if (!userData) {
      setPremiosBadge(false);
      setNextPremio(null);
      return;
    }
    const stampsCount = userData.comprasRealizadas || 0;
    getDocs(query(collection(db, "premios"), where("activo", "==", true)))
      .then((snap) => {
        const todos = snap.docs.map((d) => d.data() as any);
        const puedeCanejear = todos.some(
          (p) => !p.esSorteo && typeof p.sellosRequeridos === "number" && stampsCount >= p.sellosRequeridos
        );
        setPremiosBadge(puedeCanejear);
        // Próximo premio no-sorteo más cercano que aún no alcanza
        const proximos = todos
          .filter((p) => !p.esSorteo && typeof p.sellosRequeridos === "number" && p.sellosRequeridos > stampsCount)
          .sort((a: any, b: any) => a.sellosRequeridos - b.sellosRequeridos);
        setNextPremio(proximos.length > 0 ? { nombre: proximos[0].nombre || "Premio", sellosRequeridos: proximos[0].sellosRequeridos, icono: proximos[0].icono || "🎁" } : null);
      })
      .catch(() => {});
  }, [userData]);

  // Carga one-shot del directorio — los perfiles de locales cambian raramente,
  // no justifican un listener persistente que mantiene conexión por cada usuario activo.
  useEffect(() => {
    getDocs(query(collection(db, "entrepreneur_profiles")))
      .then((snapshot) => {
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
      })
      .catch((error) => {
        console.error("Error cargando directorio:", error);
        setLoading(false);
      });
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
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/check-geofence", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ latitude, longitude }),
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

  const isCarouselMode =
    selectedCategory === "all" &&
    !searchQuery &&
    !filterAbierto &&
    !filterFavoritos;

  const knownCategoryIds = new Set(CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id));
  const categorizedGroups = [
    ...CATEGORIES.filter((cat) => cat.id !== "all")
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        locals: filteredEntrepreneurs.filter((e) => e.category === cat.id),
      }))
      .filter((g) => g.locals.length > 0),
    ...((): { id: string; name: string; locals: Entrepreneur[] }[] => {
      const unknowns = filteredEntrepreneurs.filter((e) => !knownCategoryIds.has(e.category));
      return unknowns.length > 0 ? [{ id: "otros", name: "Otros", locals: unknowns }] : [];
    })(),
  ];

  const renderHero = () => (
    <>
      <style>{`
        @keyframes heroBalloonFloat {
          0%   { transform: translateY(0px) rotate(-5deg); }
          50%  { transform: translateY(-16px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(-5deg); }
        }
        @keyframes heroSparkle {
          0%, 100% { opacity: 0.5; transform: scale(0.85) rotate(-10deg); }
          50%       { opacity: 1;   transform: scale(1.2)  rotate(10deg); }
        }
        @keyframes heroAnivPulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.04); }
        }
      `}</style>
      <section style={{
        background: "linear-gradient(135deg, #C9920A 0%, #8DC63F 50%, #5BB8D4 100%)",
        padding: "40px 20px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Globos izquierda */}
        {([
          { left: "2%",  bottom: "8%",  size: 38, delay: "0s",   dur: "4.1s" },
          { left: "11%", bottom: "28%", size: 28, delay: "0.9s", dur: "3.6s" },
          { left: "3%",  bottom: "62%", size: 22, delay: "1.8s", dur: "4.5s" },
        ] as const).map((b, i) => (
          <span key={`bl-${i}`} aria-hidden style={{
            position: "absolute", left: b.left, bottom: b.bottom,
            fontSize: b.size, lineHeight: 1,
            animation: `heroBalloonFloat ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay, pointerEvents: "none", userSelect: "none", zIndex: 0,
          }}>🎈</span>
        ))}
        {/* Globos derecha */}
        {([
          { right: "2%",  bottom: "8%",  size: 36, delay: "0.5s", dur: "3.8s" },
          { right: "12%", bottom: "32%", size: 26, delay: "1.4s", dur: "4.3s" },
          { right: "3%",  bottom: "64%", size: 20, delay: "2.2s", dur: "3.5s" },
        ] as const).map((b, i) => (
          <span key={`br-${i}`} aria-hidden style={{
            position: "absolute", right: b.right, bottom: b.bottom,
            fontSize: b.size, lineHeight: 1,
            animation: `heroBalloonFloat ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay, pointerEvents: "none", userSelect: "none", zIndex: 0,
          }}>🎈</span>
        ))}
        {/* Destellos / confetti */}
        {([
          { left: "18%", top: "6%",  emoji: "✨", size: 18, delay: "0s",   dur: "2.6s" },
          { left: "75%", top: "10%", emoji: "🎊", size: 16, delay: "1.1s", dur: "3.1s" },
          { left: "47%", top: "3%",  emoji: "⭐", size: 14, delay: "0.6s", dur: "2.3s" },
          { left: "87%", top: "38%", emoji: "✨", size: 13, delay: "1.7s", dur: "2.9s" },
          { left: "7%",  top: "38%", emoji: "🎉", size: 17, delay: "0.3s", dur: "2.7s" },
          { left: "62%", top: "5%",  emoji: "🌟", size: 13, delay: "2.0s", dur: "3.3s" },
        ] as const).map((c, i) => (
          <span key={`sp-${i}`} aria-hidden style={{
            position: "absolute", left: c.left, top: c.top,
            fontSize: c.size, lineHeight: 1,
            animation: `heroSparkle ${c.dur} ease-in-out infinite`,
            animationDelay: c.delay, pointerEvents: "none", userSelect: "none", zIndex: 0,
          }}>{c.emoji}</span>
        ))}

        {/* Contenido principal */}
        <div style={{ position: "relative", zIndex: 1, width: 110, marginBottom: 16 }}>
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
        <h1 style={{ position: "relative", zIndex: 1, fontFamily: "Montserrat, sans-serif", fontSize: 24, fontWeight: 900, color: "white", margin: "0 0 8px 0", lineHeight: 1.1, letterSpacing: "1px" }}>
          CLUB<br/>
          <span style={{ color: "#FFD700", fontSize: 32, fontWeight: 900, textShadow: "0 2px 6px rgba(0,0,0,0.35)" }}>PATIO CURAUMA</span>
        </h1>
        <p style={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,0.9)", fontSize: 14, margin: 0, letterSpacing: "0.5px" }}>
          Fidelización · Premios · Comunidad
        </p>

        {/* Badge aniversario */}
        <div style={{
          position: "relative", zIndex: 1,
          marginTop: 14,
          background: "rgba(255,255,255,0.2)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1.5px solid rgba(255,255,255,0.45)",
          borderRadius: 999,
          padding: "7px 20px",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          animation: "heroAnivPulse 2.8s ease-in-out infinite",
        }}>
          <span style={{ fontSize: 18 }}>🎂</span>
          <span style={{ color: "white", fontWeight: 900, fontSize: 13, letterSpacing: "0.4px", textShadow: "0 1px 4px rgba(0,0,0,0.35)" }}>
            ¡4 Años de Patio Design Curauma!
          </span>
          <span style={{ fontSize: 18 }}>🎂</span>
        </div>
      </section>
    </>
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

            {/* Saludo + tarjeta de progreso + QR */}
            {user && userData && (
              <div style={{ marginTop: "20px", marginBottom: "4px" }}>
                {/* Banner: premio disponible */}
                {premiosBadge && (
                  <button
                    onClick={() => router.push("/premios")}
                    className="mx-6 mb-3 w-[calc(100%-3rem)] flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-[0.98] transition-transform text-left"
                    style={{ background: "linear-gradient(135deg, #FEF08A 0%, #FDE047 100%)" }}
                  >
                    <span className="text-2xl">🎁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-amber-900 leading-tight">¡Tienes un premio disponible!</p>
                      <p className="text-[11px] text-amber-800 font-medium">Toca para canjearlo ahora</p>
                    </div>
                    <span className="text-amber-700 font-black text-xl shrink-0">›</span>
                  </button>
                )}

                <div className="px-6 space-y-3">
                  {/* Fila: saludo + botones */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">
                      Hola, {userData.nombre?.split(" ")[0] || "Club Member"} 👋
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowQRModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[11px] active:scale-90 transition-transform"
                        style={{ background: "#C9920A", color: "white" }}
                        aria-label="Mostrar mi QR"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Mi QR
                      </button>
                      <button
                        onClick={() => setShowAIModal(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-90"
                        style={{ background: "linear-gradient(135deg, #6D28D9 0%, #0EA5E9 100%)", fontSize: "10px", fontWeight: 700, color: "white" }}
                        aria-label="Abrir Asistente IA"
                      >
                        <Sparkles className="w-3 h-3" />
                        IA
                      </button>
                    </div>
                  </div>

                  {/* Tarjeta de progreso */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black" style={{ color: "#C9920A" }}>
                          {userData.comprasRealizadas || 0}
                        </span>
                        {nextPremio ? (
                          <span className="text-[11px] text-slate-400 font-bold">
                            de {nextPremio.sellosRequeridos} sellos
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">sellos</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {streak > 0 && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)" }}>
                            <span className="text-xs">🔥</span>
                            <span className="text-[11px] font-black" style={{ color: "#F97316" }}>{streak} {streak === 1 ? "sem." : "sems."}</span>
                          </div>
                        )}
                        {(userData.ticketsSorteo || 0) > 0 && (
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                            🎟️ {userData.ticketsSorteo}
                          </span>
                        )}
                      </div>
                    </div>

                    {nextPremio && (
                      <>
                        <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height: "8px" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.round(((userData.comprasRealizadas || 0) / nextPremio.sellosRequeridos) * 100))}%`,
                              background: "linear-gradient(90deg, #C9920A 0%, #8DC63F 100%)",
                              transition: "width 0.8s ease-out",
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[11px] text-slate-500 font-medium">
                            {nextPremio.icono} {nextPremio.nombre}
                          </p>
                          <p className="text-[11px] font-black text-slate-600">
                            {Math.min(100, Math.round(((userData.comprasRealizadas || 0) / nextPremio.sellosRequeridos) * 100))}%
                          </p>
                        </div>
                      </>
                    )}

                    {!nextPremio && !premiosBadge && (
                      <p className="text-[11px] text-slate-400 font-medium">
                        Sigue acumulando sellos para ganar premios 🌟
                      </p>
                    )}

                    {!nextPremio && premiosBadge && (
                      <p className="text-[11px] font-bold" style={{ color: "#C9920A" }}>
                        🎉 ¡Ya alcanzaste todos los premios disponibles!
                      </p>
                    )}
                  </div>
                </div>
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

            {/* OFERTAS DEL DÍA */}
            {ofertasHoy.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6 flex items-center gap-1.5">
                  🔥 Ofertas de hoy
                </p>
                <div className="flex gap-3 overflow-x-auto px-6 pb-1 no-scrollbar">
                  {ofertasHoy.map((oferta) => (
                    <div
                      key={oferta.id}
                      className="flex-shrink-0 w-52 rounded-2xl p-3.5 space-y-1.5"
                      style={{ background: "linear-gradient(135deg, #FFF7E6 0%, #FFFBF0 100%)", border: "1px solid rgba(201,146,10,0.18)" }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#C9920A" }}>{oferta.localNombre}</p>
                      <p className="text-sm font-bold text-slate-800 leading-snug">{oferta.texto}</p>
                      <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(201,146,10,0.1)", color: "#C9920A", border: "1px solid rgba(201,146,10,0.15)" }}>Solo hoy</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            <section className="space-y-6 pt-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 px-6">
                <h2 className="text-lg font-black text-foreground">Descubre</h2>
                <Badge variant="outline" className="rounded-md border-slate-100 font-bold text-[10px]">
                  {filteredEntrepreneurs.length} Locales
                </Badge>
              </div>

              {filteredEntrepreneurs.length === 0 && !loading ? (
                <div className="py-12 text-center text-muted-foreground text-xs italic px-6">
                  No se encontraron resultados en el directorio.
                </div>
              ) : isCarouselMode ? (
                /* ── Modo carrusel: agrupado por categoría ── */
                <div className="space-y-7">
                  {categorizedGroups.map((group) => (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-center justify-between px-6">
                        <h3 className="text-sm font-black text-slate-700">{group.name}</h3>
                        <span className="text-[10px] text-slate-400 font-semibold">{group.locals.length} local{group.locals.length !== 1 ? "es" : ""}</span>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-2 px-6 no-scrollbar snap-x snap-mandatory">
                        {group.locals.map((entrepreneur, idx) => {
                          const isOpen = isOpenNow((entrepreneur as any).horariosEstructurados);
                          const distKm = userCoords ? haversineKm(userCoords.lat, userCoords.lng, (entrepreneur as any).lat ?? PATIO_INFO.coordinates.lat, (entrepreneur as any).lng ?? PATIO_INFO.coordinates.lng) : undefined;
                          return (
                            <div key={entrepreneur.id} className="min-w-[150px] max-w-[150px] shrink-0 snap-start">
                              <EntrepreneurCard entrepreneur={entrepreneur} isOpen={isOpen} distanceKm={filterCercano && distKm !== undefined ? distKm : undefined} priority={idx < 3} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Modo grid: búsqueda o filtro activo ── */
                <div className="px-6 space-y-4">
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
                </div>
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
  const isVendor = userData
    ? Array.isArray(userData.roles)
      ? userData.roles.includes("emprendedor")
      : userData.rol === "emprendedor"
    : false;

  return (
    <main className="min-h-screen bg-white">
      {showOnboarding && user && (
        <OnboardingTutorial
          userId={user.uid}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
      {showNpsSurvey && user && !showOnboarding && (
        <NpsSurvey
          userId={user.uid}
          onClose={() => setShowNpsSurvey(false)}
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
        locals={entrepreneurs}
      />

      {/* Modal de notificación push */}
      {pushNotif && (() => {
        const TIPO_MAP: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
          BROADCAST_INFO:    { label: "Información", color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  emoji: "📢" },
          BROADCAST_URGENTE: { label: "Urgente",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   emoji: "🚨" },
          BROADCAST_PROMO:   { label: "Promoción",   color: "#10b981", bg: "rgba(16,185,129,0.12)",  emoji: "🎉" },
          BROADCAST_SORTEO:  { label: "Sorteo",      color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  emoji: "🎟️" },
        };
        const cfg = TIPO_MAP[pushNotif.tipo];
        const hasCta = pushNotif.cta && pushNotif.cta !== "/";
        return (
          <div
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPushNotif(null)}
          >
            <div
              className="w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>
              <div className="px-6 pt-3 pb-8 space-y-4">
                <div className="flex items-center justify-between">
                  {cfg ? (
                    <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.emoji} {cfg.label}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Club Patio Curauma</span>
                  )}
                  <button
                    onClick={() => setPushNotif(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-xl font-black text-slate-800 leading-snug">{pushNotif.titulo}</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{pushNotif.body}</p>
                <a
                  href="https://maps.google.com/?q=Avenida+Universidad+134,+local+1,+Curauma,+Valparaíso"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl overflow-hidden border border-slate-100 active:opacity-80 transition-opacity"
                >
                  <img src="/tienda.jpeg" alt="Patio Curauma Tienda" className="w-full object-cover" style={{ maxHeight: 160 }} />
                  <div className="px-4 py-3 bg-slate-50 flex items-center gap-3">
                    <span className="text-lg">🏪</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800">Visítanos en Patio Curauma Tienda</p>
                      <p className="text-[11px] text-slate-500 truncate">Av. Universidad #134, local 1 · Curauma</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">Ver mapa →</span>
                  </div>
                </a>
                {hasCta && (
                  <Button
                    className="w-full h-12 rounded-2xl font-bold gap-2 bg-primary text-white hover:bg-primary/90"
                    onClick={() => { router.push(pushNotif.cta); setPushNotif(null); }}
                  >
                    <ExternalLink className="w-4 h-4" /> Ver más
                  </Button>
                )}
                <button
                  onClick={() => setPushNotif(null)}
                  className="w-full h-10 rounded-2xl text-sm font-bold text-slate-400 hover:bg-slate-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <VendorStampModal vendorId={isVendor && user ? user.uid : null} />

      {/* Modal QR del socio */}
      {showQRModal && user && (
        <div
          className="fixed inset-0 z-[250] flex items-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-white rounded-t-[28px] animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-3 pb-10 space-y-5 text-center">
              <div>
                <p className="text-lg font-black text-slate-800">Tu código QR</p>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Muéstraselo al emprendedor para recibir sellos
                </p>
              </div>
              <div className="flex justify-center">
                <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-lg">
                  <QRCode
                    value={user.uid}
                    size={200}
                    fgColor="#1A1A1A"
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  />
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl px-4 py-3 mx-4">
                <p className="text-sm font-bold text-slate-700">{userData?.nombre || "Socio"}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {userData?.comprasRealizadas || 0} sellos acumulados
                </p>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full h-12 rounded-2xl text-sm font-bold text-slate-400 hover:bg-slate-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOADING PUBLICIDAD */}
      {publicidadLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
          <img src="/Logo3.webp" alt="Patio Curauma" style={{ width: 90, height: "auto", marginBottom: 24 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%",
                background: "linear-gradient(135deg, #C9920A, #8DC63F)",
                animation: "pubDot 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
          <style>{`
            @keyframes pubDot {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
              40%            { transform: scale(1);   opacity: 1;   }
            }
          `}</style>
        </div>
      )}

      {/* MODAL PUBLICIDAD */}
      {showPublicidad && publicidad && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4"
          onClick={() => setShowPublicidad(false)}
        >
          <div
            className="relative w-full max-w-sm animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPublicidad(false)}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img
                src={publicidad.imageUrl}
                alt="Publicidad"
                className="w-full h-auto object-cover block"
              />
            </div>
            <div className="flex flex-col gap-2 mt-4">
              {publicidad.cta && (
                <a
                  href={publicidad.cta}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowPublicidad(false)}
                  className="w-full h-11 rounded-2xl bg-white text-slate-800 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shadow"
                >
                  <ExternalLink className="w-4 h-4" /> Ver más
                </a>
              )}
              <button
                onClick={() => setShowPublicidad(false)}
                className="w-full h-11 rounded-2xl bg-white/20 text-white font-bold text-sm backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-colors"
              >
                Cerrar
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
