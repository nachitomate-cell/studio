
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Shield } from "lucide-react";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

/**
 * Componente RoleSwitcher
 * Permite cambiar rápidamente entre las vistas de Socio, Emprendedor, Director y Admin.
 * Ubicado de forma fija en la esquina inferior derecha.
 * SOLO visible para el correo de administración.
 */
export function RoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Escuchamos el estado de autenticación para validar el correo
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Si no es el administrador, el componente no se renderiza
  if (!authorized) return null;

  const handleValueChange = (value: string) => {
    router.push(value);
  };

  // Valor actual basado en la ruta para mantener el select sincronizado
  const currentValue = ["/", "/vendedor", "/director", "/moderador"].includes(pathname) 
    ? pathname 
    : "";

  return (
    <div className="fixed bottom-20 right-4 z-[100] md:bottom-6 animate-in fade-in slide-in-from-right-4 duration-500">
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
            🛠️ Master Admin - {ADMIN_EMAIL}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
