
"use client";

import { User, Gift, LayoutGrid, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const router = useRouter();

  const navItems = [
    { id: "directory", label: "Descubre", icon: LayoutGrid },
    { id: "scan", label: "Escanear", icon: QrCode, isAction: true },
    { id: "rewards", label: "Premios", icon: Gift },
    { id: "profile", label: "Mi Perfil", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] px-4 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          if (item.isAction) {
            return (
              <button
                key={item.id}
                onClick={() => router.push('/scan')}
                className="flex flex-col items-center justify-center gap-1 w-full h-full relative outline-none -mt-6 group"
              >
                <div className="bg-primary text-white p-4 rounded-full shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform group-active:scale-95">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-800 mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-300 w-full h-full relative outline-none",
                isActive
                  ? "text-primary border-t-[3px] border-primary"
                  : "text-muted-foreground hover:text-primary/60 border-t-[3px] border-transparent"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "fill-current animate-bounce-short")} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
