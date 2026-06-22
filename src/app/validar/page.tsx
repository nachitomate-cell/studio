"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import ValidarPanel from "@/components/ValidarPanel";
import VendorStampModal from "@/components/VendorStampModal";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useToast } from "@/hooks/use-toast";

import { ADMIN_EMAIL } from "@/lib/constants";

export default function ValidarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace("/");
        return;
      }

      const email = (user.email ?? "").trim().toLowerCase();
      if (email === ADMIN_EMAIL) {
        setVendorId(user.uid);
        setAuthChecked(true);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const roles: string[] = Array.isArray(data.roles) ? data.roles : [];
          const rol: string = data.rol ?? "";
          const isVendor =
            roles.includes("emprendedor") || roles.includes("staff") ||
            rol === "emprendedor" || rol === "staff";
          if (isVendor) {
            setVendorId(user.uid);
            setAuthChecked(true);
            return;
          }
        }
      } catch { /* ignore */ }

      // Cliente normal intentando acceder a la herramienta de comercio.
      toast({
        variant: "destructive",
        title: "Acceso restringido",
        description: "No tienes permisos de comercio.",
      });
      router.replace("/");
    });
    return () => unsub();
  }, [router, toast]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }

  if (!vendorId) return null;

  return (
    <>
      {/* Espacio inferior para que el BottomNav no tape el contenido del panel */}
      <div className="bg-slate-50 pb-20">
        <ValidarPanel vendorId={vendorId} />
      </div>
      <VendorStampModal vendorId={vendorId} />
      <BottomNav activeTab="validar" isVendor />
    </>
  );
}
