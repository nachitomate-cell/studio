
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, Entrepreneur } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2, QrCode, Gift, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/components/profile/UserProfile";
import { EntrepreneurForm } from "@/components/profile/EntrepreneurForm";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { RecommendationWidget } from "@/components/ai/RecommendationWidget";
import { Auth } from "@/components/Auth";

export default function Home() {
  const [activeTab, setActiveTab] = useState("directory");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isManagingBusiness, setIsManagingBusiness] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  
  const [user, setUser] = useState<User | null>(auth.currentUser);
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
    const q = query(collection(db, "emprendedores"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
      setEntrepreneurs(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredEntrepreneurs = entrepreneurs.filter((e) => {
    const matchesCategory = selectedCategory === "all" || e.category.includes(selectedCategory);
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
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button 
            onClick={() => setShowAuth(true)} 
            className="h-10 rounded-lg bg-white text-foreground border border-border shadow-sm hover:bg-slate-50 font-medium text-sm gap-2"
          >
            <LogIn className="w-4 h-4" /> Entrar
          </Button>
          <Button 
            onClick={() => setShowAuth(true)} 
            className="h-10 rounded-lg bg-[#8dc63f] text-white border-none shadow-sm hover:opacity-90 font-medium text-sm gap-2"
          >
            <UserPlus className="w-4 h-4" /> Registrarse
          </Button>
        </div>
      );
    }

    if (userData?.rol === "emprendedor") {
      return (
        <div className="mt-4">
          <Button 
            onClick={() => window.location.href = "/vendedor"}
            className="w-full h-12 rounded-lg bg-[#8dc63f] text-white font-bold text-base gap-3 shadow-md hover:opacity-95"
          >
            <QrCode className="w-5 h-5" />
            Abrir Escáner de Ventas
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button 
          onClick={() => setActiveTab("profile")}
          className="h-10 rounded-lg bg-white text-foreground border border-border shadow-sm hover:bg-slate-50 font-medium text-sm gap-2"
        >
          <QrCode className="w-4 h-4" /> Mi QR
        </Button>
        <Button 
          onClick={() => setActiveTab("profile")}
          className="h-10 rounded-lg bg-[#8dc63f] text-white border-none shadow-sm hover:opacity-90 font-medium text-sm gap-2"
        >
          <Gift className="w-4 h-4" /> Premios
        </Button>
      </div>
    );
  };

  const renderContent = () => {
    if (showAuth) {
      return (
        <div className="py-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Auth />
        </div>
      );
    }

    switch (activeTab) {
      case "directory":
        return (
          <div className="space-y-8 py-4 animate-in fade-in duration-500">
            {/* Minimalist Hero */}
            <header className="space-y-4 px-2">
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  Conecta con el <span className="text-[#8dc63f]">talento local</span>
                </h1>
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Patio Curauma, Valparaíso
                </p>
              </div>
              {renderShortcuts()}
            </header>

            {/* Búsqueda */}
            <section className="px-2">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="¿Qué buscas?" 
                  className="pl-10 h-10 rounded-lg bg-slate-50 border-none shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </section>

            {/* Categorías Carrusel */}
            <section className="space-y-3">
              <h2 className="px-2 text-sm font-bold text-foreground uppercase tracking-wider">Categorías</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 px-2 no-scrollbar snap-x">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border snap-start",
                      selectedCategory === cat.id 
                        ? "bg-[#8dc63f] text-white border-transparent" 
                        : "bg-white text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Recomendaciones */}
            <div className="px-2">
              <RecommendationWidget />
            </div>

            {/* Directorio Grilla 2 Columnas */}
            <section className="space-y-4 px-2">
              <h2 className="text-xl font-bold text-foreground">Nuestros Emprendedores</h2>
              
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[#8dc63f] animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {filteredEntrepreneurs.length > 0 ? (
                    filteredEntrepreneurs.map((entrepreneur) => (
                      <EntrepreneurCard key={entrepreneur.id} entrepreneur={entrepreneur} />
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
                      No se encontraron emprendedores.
                    </div>
                  )}
                </div>
              )}
            </section>
            
            <div className="h-24" />
          </div>
        );
      case "map":
        return <div className="pt-6 px-2"><InteractiveMap /><div className="h-24" /></div>;
      case "profile":
        return <div className="pt-6 px-2"><UserProfile onSwitchMode={() => setIsManagingBusiness(true)} onShowAuth={() => setShowAuth(true)} /><div className="h-24" /></div>;
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
