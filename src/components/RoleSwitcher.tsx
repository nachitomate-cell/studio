"use client";

import { useRouter, usePathname } from "next/navigation";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Shield } from "lucide-react";

/**
 * Componente RoleSwitcher
 * Permite cambiar rápidamente entre las vistas de Socio, Emprendedor, Director y Admin.
 * Ubicado de forma fija en la esquina inferior derecha.
 */
export function RoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const handleValueChange = (value: string) => {
    router.push(value);
  };

  // Valor actual basado en la ruta para mantener el select sincronizado
  const currentValue = ["/", "/vendedor", "/director", "/moderador"].includes(pathname) 
    ? pathname 
    : "";

  return (
    <div className="fixed bottom-20 right-4 z-[100] md:bottom-6">
      <Select onValueChange={handleValueChange} value={currentValue}>
        <SelectTrigger className="w-[240px] bg-white/95 backdrop-blur-sm border-primary/30 shadow-2xl rounded-xl font-bold text-[10px] h-10 uppercase tracking-tighter transition-all hover:border-primary">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-4 h-4 fill-primary/10" />
            <SelectValue placeholder="SIMULADOR DE ROLES" />
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-primary/10 shadow-2xl z-[110]">
          <SelectItem value="/" className="font-bold text-[11px] py-3 cursor-pointer hover:bg-primary/5">
            👥 Socio Club (Inicio)
          </SelectItem>
          <SelectItem value="/vendedor" className="font-bold text-[11px] py-3 cursor-pointer hover:bg-primary/5">
            🏪 Emprendedor Aliado
          </SelectItem>
          <SelectItem value="/director" className="font-bold text-[11px] py-3 cursor-pointer hover:bg-primary/5">
            👑 Director del Patio
          </SelectItem>
          <SelectItem value="/moderador" className="font-bold text-[11px] py-3 cursor-pointer hover:bg-primary/5 text-primary">
            🛠️ Master Admin - ignaciiio.mate@gmail.com
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
