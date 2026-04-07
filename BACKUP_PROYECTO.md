# 📦 Respaldo Consolidado - Versión Estable (Presentación Jueves)

Este archivo contiene el código fuente de los módulos críticos del sistema Club Patio Curauma. Úselo para restaurar la lógica en caso de errores accidentales durante las pruebas finales.

## 1. Configuración Firebase (`src/lib/firebase.ts`)
```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCGwNEBNmyrOl1mrpZhGNEktneNtxYgxj0",
  authDomain: "studio-7914495232-557f1.firebaseapp.com",
  projectId: "studio-7914495232-557f1",
  storageBucket: "studio-7914495232-557f1.firebasestorage.app", // Verificado
  messagingSenderId: "120681935080",
  appId: "1:120681935080:web:d41757280ca888b46bd95d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
```

## 2. Directorio Principal en Tiempo Real (`src/app/page.tsx`)
```tsx
"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection, query } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EntrepreneurCard } from "@/components/directory/EntrepreneurCard";
import { CATEGORIES, Entrepreneur, PATIO_INFO } from "@/lib/data";
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
          imageUrl: data.imageUrl || data.imageUrls?.[0] || `https://picsum.photos/seed/${doc.id}/400/300`,
          contact: data.whatsapp || data.contactPhone || "",
          schedule: data.operatingHours || data.horario || "",
          locationId: data.ubicacionTienda || "loc-1"
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

  const filteredEntrepreneurs = entrepreneurs.filter((e) => {
    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderContent = () => {
    if (showAuth) return <div className="py-6 px-4"><Auth /></div>;

    switch (activeTab) {
      case "directory":
        return (
          <div className="space-y-4 py-6">
            <header className="px-6 text-center space-y-1">
              <h1 className="text-3xl font-black text-foreground">Club <span className="text-primary">Patio</span></h1>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Curauma • Fidelización</p>
            </header>
            <div className="px-6 pt-4">
              <RecommendationWidget />
            </div>
            <div className="px-6 grid grid-cols-2 gap-4">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : filteredEntrepreneurs.map(e => (
                <EntrepreneurCard key={e.id} entrepreneur={e} />
              ))}
            </div>
          </div>
        );
      case "map": return <div className="p-4"><InteractiveMap /></div>;
      case "profile": return <div className="p-4"><UserProfile onSwitchMode={() => {}} onShowAuth={() => setShowAuth(true)} /></div>;
      default: return null;
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto pb-24">{renderContent()}</div>
      <BottomNav activeTab={activeTab} onTabChange={(tab) => {setActiveTab(tab); setShowAuth(false);}} />
    </main>
  );
}
```

## 3. Panel del Vendedor con Storage (`src/app/vendedor/page.tsx`)
```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, setDoc, updateDoc, collection, query, orderBy, limit } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { registrarCompra } from "@/lib/puntos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, QrCode, Camera, CheckCircle2, Loader2, Store, Save, Upload, X } from "lucide-react";

export default function VendedorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<"dashboard" | "scanner" | "profile">("dashboard");
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shopForm, setShopForm] = useState({ nombreTienda: "", descripcion: "" });

  useEffect(() => {
    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const profileRef = doc(db, "entrepreneur_profiles", user.uid);
        onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setShopForm({ nombreTienda: data.businessName || "", descripcion: data.description || "" });
            setPreviewUrl(data.imageUrl || null);
          }
        });
      }
    });
    return () => authUnsubscribe();
  }, []);

  const handleSaveShopInfo = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      let finalImageUrl = previewUrl;
      if (profileImage) {
        const storageRef = ref(storage, `entrepreneur_photos/${auth.currentUser.uid}/profile.jpg`);
        const uploadResult = await uploadBytes(storageRef, profileImage);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      }
      const profileRef = doc(db, "entrepreneur_profiles", auth.currentUser.uid);
      await setDoc(profileRef, {
        userId: auth.currentUser.uid,
        businessName: shopForm.nombreTienda,
        description: shopForm.descripcion,
        imageUrl: finalImageUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast({ title: "¡Perfil actualizado!" });
      setView("dashboard");
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      {view === "profile" ? (
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-6 space-y-6">
            <Input placeholder="Nombre Local" value={shopForm.nombreTienda} onChange={e => setShopForm({...shopForm, nombreTienda: e.target.value})} />
            <Textarea placeholder="Descripción" value={shopForm.descripcion} onChange={e => setShopForm({...shopForm, descripcion: e.target.value})} />
            <div className="border-2 border-dashed p-4 text-center">
              <input type="file" onChange={e => e.target.files?.[0] && setProfileImage(e.target.files[0])} />
              {previewUrl && <img src={previewUrl} className="mt-2 h-32 mx-auto" />}
            </div>
            <Button onClick={handleSaveShopInfo} className="w-full" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-lg mx-auto space-y-4">
          <Button onClick={() => setView("profile")} className="w-full h-16">Configurar mi Tienda</Button>
          <Button onClick={() => setView("scanner")} className="w-full h-20 bg-primary">Escanear Cliente</Button>
        </div>
      )}
    </main>
  );
}
```

## 4. Vista de Detalle Dinámica (`src/app/emprendedor/[id]/page.tsx`)
```tsx
"use client";

import { EntrepreneurDetailView } from "@/components/directory/EntrepreneurDetailView";

/**
 * Vista de detalle del emprendedor.
 * En modo desarrollo y producción, carga los datos dinámicamente desde Firestore.
 */
export default function Page() {
  return <EntrepreneurDetailView />;
}
```
