"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Map, Loader2 } from "lucide-react";
import { isVendorVisible } from "@/lib/utils";

export default function MiRutaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userLocales, setUserLocales] = useState<Record<string, number>>({});
  const [entrepreneurs, setEntrepreneurs] = useState<any[]>([]);
  const [totalStamps, setTotalStamps] = useState(0);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/?login=true");
        return;
      }

      // Fetch user's locales stamps
      const userRef = doc(db, "usuarios", user.uid);
      const unsubUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserLocales(data.sellosLocales || {});
        }
      });

      // Fetch entrepreneurs
      const profilesRef = collection(db, "entrepreneur_profiles");
      const profilesSnap = await getDocs(profilesRef);
      const vendors = profilesSnap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.businessName || data.nombre || "Local Aliado",
            imageUrl: data.imageUrls?.[0] || data.imagenUrl || data.imagenPerfil || data.imagenTarjeta || "/Logo2.png",
            imagenTarjeta: data.imagenTarjeta,
            ...data
          };
        })
        .filter(v => isVendorVisible(v as any))
        .sort((a: any, b: any) => (a.name).localeCompare(b.name));
      
      setEntrepreneurs(vendors);
      setLoading(false);

      return () => unsubUser();
    });

    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    // Calculate total unlocked
    let count = 0;
    entrepreneurs.forEach(v => {
      if (userLocales[v.id] && userLocales[v.id] > 0) {
        count++;
      }
    });
    setTotalStamps(count);
  }, [userLocales, entrepreneurs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] pb-24 font-sans animate-in slide-in-from-right duration-300">
      <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-slate-400">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Mi Ruta</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {totalStamps} de {entrepreneurs.length} descubiertos
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 text-center space-y-2">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Map className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-lg font-black text-slate-800">Carpeta de Estampillas</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-[280px] mx-auto">
            Visita los locales aliados, canjea tus sellos y descubre todas las estampillas de nuestra comunidad.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {entrepreneurs.map(vendor => {
            const hasStamp = userLocales[vendor.id] && userLocales[vendor.id] > 0;
            const stampCount = userLocales[vendor.id] || 0;

            return (
              <div key={vendor.id} className="flex flex-col items-center gap-2">
                <div 
                  className={`
                    w-full aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center p-2 relative overflow-hidden transition-all duration-500
                    ${hasStamp ? 'border-primary/40 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 opacity-60'}
                  `}
                >
                  <img 
                    src={vendor.imageUrl} 
                    alt={vendor.name}
                    className={`
                      w-full h-full object-cover rounded-xl transition-all duration-500
                      ${hasStamp ? 'filter-none scale-100' : 'grayscale saturate-0 opacity-40 scale-95'}
                    `}
                  />
                  {/* Decorative stamp edges */}
                  <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_10px_rgba(0,0,0,0.05)]"></div>
                  
                  {hasStamp && (
                    <div className="absolute -bottom-2 -right-2 bg-primary text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                      {stampCount}
                    </div>
                  )}
                </div>
                <p className={`text-[10px] text-center font-bold leading-tight line-clamp-2 ${hasStamp ? 'text-slate-800' : 'text-slate-400'}`}>
                  {vendor.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
