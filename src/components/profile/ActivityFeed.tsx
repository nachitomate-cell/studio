"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShoppingBag, Gift, Star, Loader2, History } from "lucide-react";

type ActivityType = "sello" | "premio" | "canje";

interface ActivityItem {
  id: string;
  type: ActivityType;
  titulo: string;
  detalle: string;
  fecha: string;
}

function parseDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const ts = value as { toDate?: () => Date; seconds?: number };
    if (typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toISOString();
  }
  return "";
}

const TYPE_CONFIG: Record<ActivityType, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
  sello: {
    icon: <ShoppingBag className="w-4 h-4" />,
    bg: "rgba(157,204,101,0.12)",
    color: "#9DCC65",
    label: "Sello",
  },
  premio: {
    icon: <Star className="w-4 h-4" />,
    bg: "rgba(211,182,115,0.15)",
    color: "#D3B673",
    label: "Premio",
  },
  canje: {
    icon: <Gift className="w-4 h-4" />,
    bg: "rgba(201,146,10,0.12)",
    color: "#C9920A",
    label: "Canje",
  },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const cfg = TYPE_CONFIG[item.type];
  let fechaStr = "";
  if (item.fecha) {
    try {
      fechaStr = new Date(item.fecha).toLocaleString("es-CL", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {}
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 leading-tight truncate">{item.titulo}</p>
        {item.detalle ? (
          <p className="text-[11px] text-slate-400 font-medium truncate">{item.detalle}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right space-y-1">
        <span
          className="block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-center"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
        {fechaStr ? (
          <p className="text-[9px] text-slate-300">{fechaStr}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityFeed({ userId }: { userId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [canjesSnap, notifSnap] = await Promise.all([
          getDocs(
            query(collection(db, "canjes"), where("clienteId", "==", userId), limit(30))
          ),
          getDocs(
            query(
              collection(db, "usuarios", userId, "notificaciones"),
              orderBy("fecha", "desc"),
              limit(40)
            )
          ),
        ]);

        const canjesItems: ActivityItem[] = canjesSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: `canje-${d.id}`,
            type: "canje",
            titulo: data.premioNombre || "Premio canjeado",
            detalle: data.vendorNombre ? `en ${data.vendorNombre}` : "",
            fecha: parseDate(data.creadoEn),
          };
        });

        const notifItems: ActivityItem[] = notifSnap.docs
          .filter((d) => {
            const { tipo, fuente } = d.data() as { tipo?: string; fuente?: string };
            return fuente === "vendor_scan" || tipo === "SELLO" || tipo === "PREMIO";
          })
          .map((d) => {
            const data = d.data() as {
              tipo?: string;
              titulo?: string;
              mensaje?: string;
              fecha?: string;
            };
            const isPremio = data.tipo === "PREMIO";
            return {
              id: `notif-${d.id}`,
              type: (isPremio ? "premio" : "sello") as ActivityType,
              titulo: data.titulo || (isPremio ? "Premio alcanzado 🎁" : "Sello recibido ✅"),
              detalle: data.mensaje || "",
              fecha: data.fecha || "",
            };
          });

        const merged = [...canjesItems, ...notifItems]
          .filter((item) => !!item.fecha)
          .sort((a, b) => b.fecha.localeCompare(a.fecha))
          .slice(0, 20);

        if (!cancelled) setItems(merged);
      } catch (e) {
        console.warn("[ActivityFeed]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <History className="w-5 h-5" style={{ color: "#D3B673" }} />
        <h3 className="font-bold text-lg" style={{ color: "#D3B673" }}>
          Historial de actividad
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-50 p-8 rounded-3xl text-center space-y-2 border-2 border-dashed border-slate-200">
          <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-400 font-medium italic">
            Aquí verás tus sellos y canjes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
