"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { registrarCompra } from "@/lib/puntos";
import { SuccessScanner } from "@/components/loyalty/SuccessScanner";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function CanjeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const localId = searchParams.get("localId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    vendorName: string;
    userDisplayName: string;
    newTotalSellos: number;
  } | null>(null);

  const processingRef = useRef(false);

  useEffect(() => {
    if (!localId) {
      setError("Código de local inválido.");
      setLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // Guardar la URL completa del canje pendiente para procesarla post-registro/login
        const currentUrl = `/canje?localId=${localId}`;
        localStorage.setItem("pending_stamp", currentUrl);
        toast({
          title: "Un paso más 🚀",
          description: "Regístrate o inicia sesión y te llevamos directamente a tu sello.",
        });
        router.push("/?login=true");
        return;
      }
      if (!processingRef.current) {
        processingRef.current = true;
        processCanje(user.uid, localId);
      }
    });

    return () => unsubscribe();
  }, [localId, router, toast]);

  const processCanje = async (userId: string, vendorId: string) => {
    try {
      // Intentar obtener info del local
      const vendorRef = doc(db, "entrepreneur_profiles", vendorId);
      const vendorSnap = await getDoc(vendorRef);

      let shopName = "Local Aliado";
      if (vendorSnap.exists()) {
        const vendorData = vendorSnap.data();
        shopName = vendorData.businessName || vendorData.nombre || "Local Aliado";
      } else {
        const vendorUserRef = doc(db, "usuarios", vendorId);
        const vendorUserSnap = await getDoc(vendorUserRef);
        if (vendorUserSnap.exists()) {
          const vData = vendorUserSnap.data();
          shopName = vData.nombreTienda || vData.nombre || "Local Aliado";
        }
      }

      // Obtener datos del usuario
      const userRef = doc(db, "usuarios", userId);
      const userSnap = await getDoc(userRef);
      const prevSellos = userSnap.exists() ? (userSnap.data().comprasRealizadas || 0) : 0;
      const displayName = userSnap.exists() ? (userSnap.data().nombre || "") : "";

      // Registrar la compra
      await registrarCompra(db, userId, vendorId, true);

      toast({
        title: "¡Sello Agregado! 🎉",
        description: `Has sumado 1 sello en ${shopName}.`
      });

      setSuccessData({
        vendorName: shopName,
        userDisplayName: displayName,
        newTotalSellos: prevSellos + 1,
      });

    } catch (err: any) {
      console.error("Error canje:", err);
      if (err?.message?.toLowerCase().includes("esperar") || err?.message?.toLowerCase().includes("horas")) {
        setError(err.message);
      } else {
        setError("Ocurrió un error al canjear el sello.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <SuccessScanner
        vendorName={successData.vendorName}
        userDisplayName={successData.userDisplayName}
        newTotalSellos={successData.newTotalSellos}
        onTimerEnd={() => router.push("/")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-6">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <h2 className="text-xl font-bold">Procesando...</h2>
            <p className="text-slate-500 text-sm">Validando tu sello, por favor espera.</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-xl font-bold text-red-600">Error</h2>
            <p className="text-slate-600 font-medium">{error}</p>
            <Button 
              onClick={() => router.push("/")}
              className="mt-4 w-full bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Directorio
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CanjePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    }>
      <CanjeContent />
    </Suspense>
  );
}
