
"use client";

import { User, Map, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const navItems = [
    { id: "directory", label: "Directorio", icon: LayoutGrid },
    { id: "map", label: "Mapa", icon: Map },
    { id: "profile", label: "Mi Perfil", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] px-4 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-300 w-full h-full relative",
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary/60"
              )}
            >
              {isActive && (
                <div className="absolute -top-1 w-8 h-1 bg-primary rounded-full animate-in fade-in zoom-in duration-300" />
              )}
              <Icon className={cn("w-6 h-6", isActive && "fill-current animate-bounce-short")} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Custom simple animation in CSS for bounce
/* 
@keyframes bounce-short {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.animate-bounce-short {
  animation: bounce-short 1s ease-in-out infinite;
}
*/
