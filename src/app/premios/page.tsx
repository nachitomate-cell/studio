"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RewardsView } from "@/components/RewardsView";

export default function PremiosPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userSellos, setUserSellos] = useState(0);

  // Auth + redirect
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("url_retorno", "/premios");
        }
        router.push("/?login=true");
        return;
      }
      setUserId(user.uid);
      setUserName(user.displayName || "Miembro");
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // Sellos en tiempo real (para el header)
  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, "usuarios", userId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setUserSellos(snap.data().comprasRealizadas || 0);
    });
    return () => unsub();
  }, [userId]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }

  const user = auth.currentUser;
  const userData = { comprasRealizadas: userSellos, nombre: userName };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header sticky */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            className="text-slate-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-800">Mis Premios</h1>
            <p className="text-xs text-slate-400 font-medium">
              {userSellos} sello{userSellos !== 1 ? "s" : ""} disponibles
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-2xl font-black text-sm"
            style={{ backgroundColor: "rgba(211,182,115,0.12)", color: "#D3B673" }}
          >
            {userSellos} ⭐
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        <RewardsView
          user={user}
          userData={userData}
          onShowAuth={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem("url_retorno", "/premios");
            }
            router.push("/?login=true");
          }}
        />
      </div>
    </main>
  );
}
