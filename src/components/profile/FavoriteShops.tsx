"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Store, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ShopInfo {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  sellos: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  gourmet: "Gourmet",
  belleza: "Belleza",
  deco: "Decoración",
  joyeria: "Joyería",
  artesania: "Artesanía",
  papeleria: "Papelería",
  infantil: "Infantil",
};

function ShopRow({ shop, rank }: { shop: ShopInfo; rank: number }) {
  return (
    <Link href={`/emprendedor/${shop.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 active:scale-[0.98] transition-all">
        <span className="text-xs font-black text-slate-300 w-5 shrink-0 text-center">
          #{rank}
        </span>

        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
          {shop.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={shop.imageUrl} alt={shop.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store className="w-5 h-5 text-slate-300" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 leading-tight truncate">{shop.name}</p>
          {shop.category ? (
            <p className="text-[11px] text-slate-400 font-medium">
              {CATEGORY_LABELS[shop.category] ?? shop.category}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <div className="text-right">
            <p className="text-base font-black leading-none" style={{ color: "#D3B673" }}>
              {shop.sellos}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {shop.sellos === 1 ? "sello" : "sellos"}
            </p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        </div>
      </div>
    </Link>
  );
}

export function FavoriteShops({
  sellosLocales,
}: {
  sellosLocales: Record<string, number>;
}) {
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Stringify para comparación estable en useEffect
  const sellosKey = JSON.stringify(sellosLocales);

  useEffect(() => {
    const entries = Object.entries(sellosLocales)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (entries.length === 0) {
      setShops([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      entries.map(async ([vendorId, sellos]) => {
        try {
          const snap = await getDoc(doc(db, "entrepreneur_profiles", vendorId));
          const data = snap.data();
          if (!data) return null;
          return {
            id: vendorId,
            name: data.businessName || data.nombre || "Local",
            category: data.category || data.rubro || "",
            imageUrl:
              data.imageUrls?.[0] ||
              data.imageUrl ||
              data.imagenTarjeta ||
              data.imagenPerfil ||
              "",
            sellos,
          } satisfies ShopInfo;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setShops(results.filter((r): r is ShopInfo => r !== null));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellosKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (shops.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Store className="w-5 h-5" style={{ color: "#D3B673" }} />
        <h3 className="font-bold text-lg" style={{ color: "#D3B673" }}>
          Mis locales favoritos
        </h3>
      </div>

      <div className="space-y-2">
        {shops.map((shop, i) => (
          <ShopRow key={shop.id} shop={shop} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
