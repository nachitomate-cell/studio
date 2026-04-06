
"use client";

import { useState } from "react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, ENTREPRENEURS } from "@/lib/data";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, MapPin } from "lucide-react";
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
  const [showAuth, setShowAuth] = useState(false); // Toggle para visualizar Auth

  const filteredEntrepreneurs = ENTREPRENEURS.filter((e) => {
    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderContent = () => {
    if (showAuth) {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 py-10">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-primary">Autenticación</h1>
            <Button variant="outline" size="sm" onClick={() => setShowAuth(false)}>Cerrar</Button>
          </div>
          <Auth />
        </div>
      );
    }

    switch (activeTab) {
      case "directory":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-primary tracking-tight">Curauma Conecta</h1>
                  <p className="text-muted-foreground flex items-center gap-1 text-sm mt-1">
                    <MapPin className="w-3 h-3 text-accent-foreground" />
                    Patio Curauma, Valparaíso
                  </p>
                </div>
                <button 
                  onClick={() => setShowAuth(true)}
                  className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                >
                  <span className="font-bold text-xl">C</span>
                </button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Buscar emprendedores..." 
                    className="pl-10 h-12 rounded-xl bg-white border-border/50 focus:ring-primary/20 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-border/50 bg-white">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                </Button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border",
                      selectedCategory === cat.id 
                        ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105" 
                        : "bg-white text-muted-foreground border-border/50 hover:bg-accent/10 hover:border-accent"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </header>

            <RecommendationWidget />

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-bold text-primary">Resultados ({filteredEntrepreneurs.length})</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredEntrepreneurs.length > 0 ? (
                  filteredEntrepreneurs.map((entrepreneur) => (
                    <EntrepreneurCard key={entrepreneur.id} entrepreneur={entrepreneur} />
                  ))
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="text-muted-foreground font-medium">No encontramos resultados</p>
                    <Button variant="link" onClick={() => {setSearchQuery(""); setSelectedCategory("all")}}>
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </div>
            </section>
            <div className="h-20" />
          </div>
        );
      case "map":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-primary">Ubicación</h1>
            <InteractiveMap />
            <div className="h-20" />
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isManagingBusiness ? (
              <EntrepreneurForm onBack={() => setIsManagingBusiness(false)} />
            ) : (
              <UserProfile onSwitchMode={() => setIsManagingBusiness(true)} />
            )}
            <div className="h-20" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-4">
        {renderContent()}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
