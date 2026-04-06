
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, Entrepreneur, ENTREPRENEURS } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Search, Loader2, QrCode, Gift, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/components/profile/UserProfile";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { RecommendationWidget } from "@/components/ai/RecommendationWidget";
import { Auth } from "@/components/Auth";

export default function Home() {
  const [activeTab, setActiveTab] = useState("directory");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [entrepreneurs, setEntrepreneurs] = useState<Entrepreneur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "usuarios", currentUser.uid);
        const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
        });
        return () => unsubscribeDoc();
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Intentamos cargar de Firestore, pero priorizamos la data estática local
    // para asegurar consistencia con el listado oficial solicitado
    setEntrepreneurs(ENTREPRENEURS);
    setLoading(false);

    // Mantenemos la escucha de Firestore como respaldo opcional
    const q = query(collection(db, "emprendedores"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.nombre || "Sin nombre",
            category: data.rubro?.toLowerCase() || "otros",
            description: data.descripcion || "",
            locationId: data.ubicacion || "loc-1",
            contact: data.contacto || data.whatsapp || "No disponible",
            schedule: data.horario || "Consultar horario",
            imageUrl: data.imagenUrl || `https://picsum.photos/seed/${doc.id}/400/300`
          } as Entrepreneur;
        });
        // Si hay data en Firestore, podrías elegir mezclarla o reemplazarla
        // Para este MVP priorizaremos que el usuario vea su lista oficial
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredEntrepreneurs = entrepreneurs.filter((e) => {
    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setShowAuth(false);
  };

  const renderShortcuts = () => {
    if (!user) {
      return (
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Button 
            onClick={() => setShowAuth(true)} 
            variant="outline"
            className="h-11 rounded-lg border-slate-200 shadow-sm hover:bg-slate-50 font-bold text-sm gap-2"
          >
            <LogIn className="w-4 h-4 text-slate-400" /> Entrar
          </Button>
          <Button 
            onClick={() => setShowAuth(true)} 
            className="h-11 rounded-lg bg-[#8dc63f] text-white border-none shadow-md hover:opacity-90 font-bold text-sm gap-2"
          >
            <UserPlus className="w-4 h-4" /> Registrarse
          </Button>
        </div>
      );
    }

    if (userData?.rol === "emprendedor") {
      return (
        <div className="mt-6">
          <Button 
            onClick={() => window.location.href = "/vendedor"}
            className="w-full h-14 rounded-xl bg-[#8dc63f] text-white font-bold text-lg gap-3 shadow-lg hover:scale-[1.01] transition-transform"
          >
            <QrCode className="w-6 h-6" />
            Abrir Escáner de Sellos
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Button 
          onClick={() => setActiveTab("profile")}
          variant="outline"
          className="h-11 rounded-lg border-slate-200 shadow-sm font-bold text-sm gap-2 bg-white"
        >
          <QrCode className="w-4 h-4 text-[#8dc63f]" /> Mi QR
        </Button>
        <Button 
          onClick={() => setActiveTab("profile")}
          className="h-11 rounded-lg bg-[#8dc63f] text-white border-none shadow-md hover:opacity-90 font-bold text-sm gap-2"
        >
          <Gift className="w-4 h-4" /> Mis Sellos
        </Button>
      </div>
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
          <div className="space-y-8 py-6 animate-in fade-in duration-500 bg-white">
            <header className="px-6 text-center space-y-3">
              <h1 className="text-4xl font-bold text-foreground tracking-tight leading-tight">
                Únete al <span className="text-[#8dc63f]">Club Patio</span>
              </h1>
              <p className="text-muted-foreground text-sm max-w-[300px] mx-auto leading-relaxed">
                Acumula sellos en tus tiendas favoritas y gana recompensas exclusivas.
              </p>
              {renderShortcuts()}
            </header>

            <section className="px-6">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-[#8dc63f] transition-colors" />
                <Input 
                  placeholder="Busca tiendas o productos..." 
                  className="pl-12 h-12 rounded-xl bg-slate-50 border-none shadow-sm focus:ring-2 focus:ring-[#8dc63f]/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="px-6 flex items-center justify-between">
                <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Categorías</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 px-6 no-scrollbar snap-x">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-6 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border snap-start",
                      selectedCategory === cat.id 
                        ? "bg-[#8dc63f] text-white border-transparent shadow-md shadow-[#8dc63f]/20" 
                        : "bg-white text-foreground border-slate-200 hover:border-[#8dc63f]/50"
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

            <section className="space-y-6 px-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-foreground">Nuestros Emprendedores</h2>
                <Badge variant="outline" className="rounded-md border-slate-100 font-bold text-[10px] py-0 h-5 bg-slate-50">
                  {filteredEntrepreneurs.length} Puestos
                </Badge>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 text-[#8dc63f] animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {filteredEntrepreneurs.length > 0 ? (
                    filteredEntrepreneurs.map((entrepreneur) => (
                      <EntrepreneurCard key={entrepreneur.id} entrepreneur={entrepreneur} />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                        <Search className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-muted-foreground text-sm font-medium">No encontramos ninguna tienda que coincida.</p>
                    </div>
                  )}
                </div>
              )}
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
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </main>
  );
}
