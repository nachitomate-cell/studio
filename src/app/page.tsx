
"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, Entrepreneur } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, MapPin, Loader2, QrCode, Gift, Zap, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Escuchar Auth y datos de usuario
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

  // Cargar emprendedores desde Firestore
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
    }, (error) => {
      console.error("Error fetching entrepreneurs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredEntrepreneurs = entrepreneurs.filter((e) => {
    const matchesCategory = selectedCategory === "all" || e.category.includes(selectedCategory);
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.category.toLowerCase().includes(searchQuery.toLowerCase());
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
            className="h-14 rounded-2xl bg-white text-primary border-none shadow-md hover:bg-slate-50 font-bold gap-2"
          >
            <LogIn className="w-5 h-5" /> Iniciar Sesión
          </Button>
          <Button 
            onClick={() => setShowAuth(true)} 
            className="h-14 rounded-2xl bg-accent text-accent-foreground border-none shadow-md hover:bg-accent/90 font-bold gap-2"
          >
            <UserPlus className="w-5 h-5" /> Crear Cuenta
          </Button>
        </div>
      );
    }

    if (userData?.rol === "emprendedor") {
      return (
        <div className="mt-6">
          <Button 
            onClick={() => window.location.href = "/vendedor"}
            className="w-full h-16 rounded-2xl bg-accent text-accent-foreground font-bold text-lg gap-3 shadow-xl shadow-accent/20 border-none animate-pulse hover:animate-none"
          >
            <QrCode className="w-7 h-7" />
            Abrir Escáner de Ventas
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Button 
          onClick={() => setActiveTab("profile")}
          className="h-14 rounded-2xl bg-white text-primary border-none shadow-md hover:bg-slate-50 font-bold gap-2"
        >
          <QrCode className="w-5 h-5" /> Mi QR
        </Button>
        <Button 
          onClick={() => setActiveTab("profile")}
          className="h-14 rounded-2xl bg-accent text-accent-foreground border-none shadow-md hover:bg-accent/90 font-bold gap-2"
        >
          <Gift className="w-5 h-5" /> Premios
        </Button>
      </div>
    );
  };

  const renderContent = () => {
    if (showAuth) {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 py-10">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-primary">Autenticación</h1>
            <Button variant="outline" size="sm" onClick={() => setShowAuth(false)}>Volver</Button>
          </div>
          <Auth />
        </div>
      );
    }

    switch (activeTab) {
      case "directory":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section */}
            <header className="relative -mx-4 px-4 pt-12 pb-16 bg-gradient-to-br from-primary to-accent rounded-b-[3rem] shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/20 rounded-full -ml-10 -mb-10 blur-2xl" />
              
              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
                      Conecta con el <br /> <span className="text-accent-foreground">talento local</span>
                    </h1>
                    <p className="text-primary-foreground/90 flex items-center gap-1.5 text-sm mt-2 font-medium">
                      <MapPin className="w-4 h-4" />
                      Patio Curauma, Valparaíso
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/30 shadow-inner">
                    <span className="font-bold text-2xl">C</span>
                  </div>
                </div>

                {renderShortcuts()}
              </div>
            </header>

            {/* Búsqueda y Filtros */}
            <section className="space-y-4 -mt-12 px-1">
              <div className="flex gap-2">
                <div className="relative flex-1 group shadow-xl rounded-2xl overflow-hidden">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="¿Qué buscas hoy? (ej: Comida, Plantas...)" 
                    className="pl-12 h-14 rounded-2xl bg-white border-none text-base focus-visible:ring-primary/20 transition-all shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-none bg-white shadow-xl text-primary hover:bg-slate-50">
                  <SlidersHorizontal className="w-6 h-6" />
                </Button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300 border-none shadow-sm",
                      selectedCategory === cat.id 
                        ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                        : "bg-white text-muted-foreground hover:bg-accent/10 hover:text-primary"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Recomendaciones AI */}
            <div className="px-1">
              <RecommendationWidget />
            </div>

            {/* Resultados del Directorio */}
            <section className="space-y-6 px-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-accent-foreground fill-accent-foreground" />
                  <h2 className="text-2xl font-bold text-primary">Directorio Local</h2>
                </div>
                <Badge variant="outline" className="border-primary/20 text-primary font-bold">
                  {filteredEntrepreneurs.length} Puestos
                </Badge>
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl" />
                  </div>
                  <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">Sincronizando Patio...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredEntrepreneurs.length > 0 ? (
                    filteredEntrepreneurs.map((entrepreneur) => (
                      <EntrepreneurCard key={entrepreneur.id} entrepreneur={entrepreneur} />
                    ))
                  ) : (
                    <div className="py-20 text-center space-y-4 col-span-full bg-white rounded-[2rem] border border-dashed border-border/60 shadow-sm">
                      <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                        <Search className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-primary font-bold text-lg">No encontramos resultados</p>
                        <p className="text-muted-foreground text-sm">Prueba con otra palabra o categoría.</p>
                      </div>
                      <Button variant="link" className="text-primary font-bold" onClick={() => {setSearchQuery(""); setSelectedCategory("all")}}>
                        Limpiar todos los filtros
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
            
            <div className="h-24" />
          </div>
        );
      case "map":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8">
            <h1 className="text-3xl font-bold text-primary">Mapa del Patio</h1>
            <InteractiveMap />
            <div className="h-24" />
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8">
            {isManagingBusiness ? (
              <EntrepreneurForm onBack={() => setIsManagingBusiness(false)} />
            ) : (
              <UserProfile 
                onSwitchMode={() => setIsManagingBusiness(true)} 
                onShowAuth={() => setShowAuth(true)}
              />
            )}
            <div className="h-24" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <div className="max-w-lg mx-auto px-4 pb-4">
        {renderContent()}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </main>
  );
}
