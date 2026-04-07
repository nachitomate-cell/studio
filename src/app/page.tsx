
"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, Entrepreneur, ENTREPRENEURS, PATIO_INFO } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Search, Loader2, QrCode, Gift, LogIn, UserPlus, Sparkles, Trophy, Instagram, Facebook, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/components/profile/UserProfile";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { RecommendationWidget } from "@/components/ai/RecommendationWidget";
import { Auth } from "@/components/Auth";
import { procesarProximidadGeofence } from "@/lib/notificaciones";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [activeTab, setActiveTab] = useState("directory");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [entrepreneurs, setEntrepreneurs] = useState<Entrepreneur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
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

  useEffect(() => {
    if (!user || !userData) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const targetLat = PATIO_INFO.coordinates.lat;
        const targetLng = PATIO_INFO.coordinates.lng;

        const R = 6371e3;
        const φ1 = latitude * Math.PI/180;
        const φ2 = targetLat * Math.PI/180;
        const Δφ = (targetLat-latitude) * Math.PI/180;
        const Δλ = (targetLng-longitude) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance < 500) {
          procesarProximidadGeofence(
            user.uid, 
            userData.nombre || "Miembro", 
            userData.comprasRealizadas || 0,
            true
          );
        }
      },
      (error) => {},
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, userData]);

  useEffect(() => {
    setEntrepreneurs(ENTREPRENEURS);
    setLoading(false);
  }, []);

  const filteredEntrepreneurs = entrepreneurs.filter((e) => {
    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderHero = () => {
    if (user) return null;

    return (
      <section className="px-6 py-8">
        <div className="bg-gradient-to-br from-primary to-accent/40 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-primary/20">
          <div className="relative z-10 space-y-4">
            <Badge className="bg-white/20 text-white border-none backdrop-blur-sm px-3 py-1 font-bold text-[10px] uppercase tracking-widest">
              Promo Bienvenida
            </Badge>
            <h1 className="text-3xl font-black leading-tight">
              ¡Gana tu primer sello gratis! 🎁
            </h1>
            <p className="text-sm opacity-90 font-medium leading-relaxed max-w-[220px]">
              Regístrate hoy desde nuestras redes y comienza a participar en el Gran Sorteo.
            </p>
            <Button 
              onClick={() => setShowAuth(true)} 
              className="bg-white text-primary hover:bg-white/90 font-bold rounded-xl px-6 h-12 shadow-lg"
            >
              ¡Quiero mi Sello!
            </Button>
          </div>
          <Sparkles className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
        </div>
      </section>
    );
  };

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
          <div className="space-y-4 py-6 bg-white">
            <header className="px-6 text-center space-y-2">
              <h1 className="text-3xl font-black text-foreground tracking-tighter">
                Club <span className="text-primary">Patio</span>
              </h1>
              <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em]">Curauma • Fidelización</p>
            </header>

            {renderHero()}

            {user && (
              <section className="px-6">
                <Card className="border-none shadow-md bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Mis Tickets Sorteo</p>
                      <p className="text-xl font-black text-slate-800">{userData?.ticketsSorteo || 0}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setActiveTab("profile")} variant="ghost" className="text-xs font-bold text-primary">Ver Perfil</Button>
                </Card>
              </section>
            )}

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
                      "px-5 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                      selectedCategory === cat.id 
                        ? "bg-primary text-white border-transparent shadow-md" 
                        : "bg-white text-foreground border-slate-100 hover:border-primary/30"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </section>

            <div className="px-6">
              <RecommendationWidget />
            </div>

            <section className="space-y-6 px-6 pt-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-lg font-black text-foreground">Directorio</h2>
                <Badge variant="outline" className="rounded-md border-slate-100 font-bold text-[10px]">
                  {filteredEntrepreneurs.length} Locales
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {filteredEntrepreneurs.length > 0 ? (
                  filteredEntrepreneurs.map((entrepreneur) => (
                    <EntrepreneurCard key={entrepreneur.id} entrepreneur={entrepreneur} />
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-muted-foreground text-xs italic">
                    No se encontraron resultados.
                  </div>
                )}
              </div>
            </section>

            <section className="px-6 py-12 text-center space-y-4 bg-slate-50 mt-10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Síguenos y entérate de todo</p>
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
      case "map":
        return <div className="pt-6 px-4 bg-white"><InteractiveMap /><div className="h-24" /></div>;
      case "profile":
        return <div className="pt-6 px-4 bg-white"><UserProfile onSwitchMode={() => {}} onShowAuth={() => setShowAuth(true)} /><div className="h-24" /></div>;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto pb-4">
        {renderContent()}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab);
        setShowAuth(false);
      }} />
    </main>
  );
}
