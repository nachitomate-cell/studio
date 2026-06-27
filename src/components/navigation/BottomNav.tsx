
"use client";

import { User, Gift, LayoutGrid, QrCode, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: typeof User;
  isAction?: boolean;
  route?: string;
}

interface BottomNavProps {
  activeTab: string;
  /** Provisto en la home (tabs in-page). En otras rutas se omite y se navega por URL. */
  onTabChange?: (tab: string) => void;
  premiosBadge?: boolean;
  /** Emprendedor/staff: muestra "Validar" como primer botón y oculta el QR central. */
  isVendor?: boolean;
}

export function BottomNav({ activeTab, onTabChange, premiosBadge = false, isVendor = false }: BottomNavProps) {
  const router = useRouter();

  const clientItems: NavItem[] = [
    { id: "directory", label: "Descubre", icon: LayoutGrid },
    { id: "scan", label: "Escanear", icon: QrCode, isAction: true },
    { id: "rewards", label: "Premios", icon: Gift },
    { id: "profile", label: "Mi Perfil", icon: User },
  ];

  // El emprendedor entra a su herramienta de trabajo (Validar) por defecto, pero
  // mantiene acceso al mall. Sin QR flotante central para no romper el layout.
  const vendorItems: NavItem[] = [
    { id: "validar", label: "Validar", icon: CheckCircle },
    { id: "directory", label: "Descubre", icon: LayoutGrid },
    { id: "rewards", label: "Premios", icon: Gift },
    { id: "profile", label: "Mi Perfil", icon: User },
  ];

  const navItems = isVendor ? vendorItems : clientItems;

  // Tabs de la home se resuelven in-page si hay onTabChange; si no, se navega a la
  // home con el tab pre-seleccionado vía query param.
  const handleNav = (item: NavItem) => {
    if (item.route) { router.push(item.route); return; }
    if (item.isAction) { router.push("/scan"); return; }
    if (onTabChange) { onTabChange(item.id); return; }
    router.push(`/?tab=${item.id}`);
  };

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

          const showBadge = item.id === "rewards" && premiosBadge;

          return (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-300 w-full h-full relative outline-none",
                isActive
                  ? "text-primary border-t-[3px] border-primary"
                  : "text-muted-foreground hover:text-primary/60 border-t-[3px] border-transparent"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-6 h-6", isActive && "fill-current animate-bounce-short")} />
                {showBadge && (
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#ef4444",
                      border: "1.5px solid white",
                    }}
                  />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
