"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!mounted || (isOnline && !showReconnected)) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors duration-300",
        isOnline ? "bg-green-500 text-white" : "bg-slate-900 text-white"
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4 shrink-0" />
          Conexión restaurada
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          Sin conexión — mostrando datos guardados
        </>
      )}
    </div>
  );
}
