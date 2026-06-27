"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Validar ahora vive como tab in-page en la Home (`/?tab=validar`). Este endpoint
// queda como redirect para conservar QRs/bookmarks previos.
export default function ValidarRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?tab=validar");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
    </div>
  );
}
