"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import ValidarPanel from "@/components/ValidarPanel";
import VendorStampModal from "@/components/VendorStampModal";

import { ADMIN_EMAIL } from "@/lib/constants";

export default function ValidarPage() {
  const router = useRouter();
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
          const isVendor = roles.includes("emprendedor") || rol === "emprendedor";
          if (isVendor) {
            setVendorId(user.uid);
            setAuthChecked(true);
            return;
          }
        }
      } catch { /* ignore */ }

      router.replace("/");
    });
    return () => unsub();
  }, [router]);

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
      <ValidarPanel vendorId={vendorId} />
      <VendorStampModal vendorId={vendorId} />
    </>
  );
}
