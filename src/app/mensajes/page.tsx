"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, Trash2, X, Sparkles, Calendar, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function NotifDetailModal({ notif, onClose }: { notif: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2" />
        <div className="flex items-start justify-between gap-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", notif.isAI ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
            {notif.isAI ? <Sparkles className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 leading-snug">{notif.titulo}</h2>
          <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-widest">
            {new Date(notif.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <p className="text-base text-slate-600 leading-relaxed">{notif.mensaje}</p>
        <button
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function SwipeableNotification({ notif, onDelete, onOpen }: { notif: any; onDelete: (id: string) => void; onOpen: (notif: any) => void }) {
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: any) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: any) => {
    const diff = e.touches[0].clientX - startX;
    if (diff < 0) {
      setIsSwiping(true);
      setOffsetX(Math.max(diff, -100));
    }
  };

  const handleTouchEnd = () => {
    if (offsetX < -60) {
      setOffsetX(-150);
      setTimeout(() => onDelete(notif.id), 200);
    } else {
      setOffsetX(0);
    }
  };

  const handleClick = () => {
    if (!isSwiping) onOpen(notif);
  };

  const hasAction = !!notif.actionUrl;

  return (
    <div className="relative overflow-hidden rounded-2xl">
       <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl">
          <Trash2 className="text-white w-6 h-6 animate-pulse" />
       </div>
       <div
          className="relative transition-transform duration-200 cursor-pointer"
          style={{ transform: `translateX(${offsetX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
       >
          <Card className={cn(
            "border-none shadow-sm rounded-2xl overflow-hidden transition-all",
            notif.isAI ? "bg-gradient-to-br from-white to-primary/5 border-l-4 border-l-primary" : "bg-white",
            !notif.leida && "border-l-4 border-l-[#C9A84C]",
            hasAction && "border-l-4 border-l-amber-400"
          )}>
            <CardContent className="p-4 flex gap-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", notif.isAI ? "bg-primary text-white" : hasAction ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400")}>
                {notif.isAI ? <Sparkles className="w-5 h-5" /> : hasAction ? <span className="text-base">🛒</span> : <Bell className="w-5 h-5" />}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={cn("text-sm font-bold", !notif.leida ? "text-slate-900" : "text-slate-700")}>{notif.titulo}</h4>
                  <span className="text-[9px] text-slate-400 uppercase font-bold">{new Date(notif.fecha).toLocaleDateString()}</span>
                </div>
                <p className={cn("text-xs leading-relaxed line-clamp-2", !notif.leida ? "text-slate-600 font-medium" : "text-slate-400")}>{notif.mensaje}</p>
                {hasAction && (
                  <span className="inline-block text-[10px] font-bold text-amber-600 uppercase tracking-wide mt-0.5">Toca para abrir panel →</span>
                )}
              </div>
            </CardContent>
          </Card>
       </div>
    </div>
  );
}

export default function MensajesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/");
        return;
      }
      setUser(currentUser);
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
    const q = query(notifRef, orderBy("fecha", "desc"));
    
    const unsubNotif = onSnapshot(q, (snapshot) => {
      setNotificaciones(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsubNotif();
  }, [user]);

  const handleDeleteNotif = async (notifId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "usuarios", user.uid, "notificaciones", notifId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllNotifs = async () => {
    if (!user || notificaciones.length === 0) return;
    if (!confirm("¿Deseas eliminar todos los mensajes de tu bandeja?")) return;
    
    try {
      const batchPromises = notificaciones.map(n => 
        deleteDoc(doc(db, "usuarios", user.uid, "notificaciones", n.id))
      );
      await Promise.all(batchPromises);
      toast({ title: "Bandeja limpiada", description: "Has eliminado todos tus mensajes." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la bandeja." });
    }
  };

  const handleOpenNotif = async (notif: any) => {
    if (!notif.leida && user) {
      try {
        await updateDoc(doc(db, "usuarios", user.uid, "notificaciones", notif.id), { leida: true });
      } catch (e) {
        console.error("Error marking notif as read", e);
      }
    }
    if (notif.actionUrl) {
      router.push(notif.actionUrl);
    } else if (notif.broadcastId) {
      router.push(`/notificacion?id=${notif.broadcastId}`);
    } else {
      setSelectedNotif(notif);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 pb-32 animate-in fade-in duration-500">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-5 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => router.back()}
            className="text-slate-400 shrink-0 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-slate-800 truncate">Mensajes del Club</h1>
            <p className="text-[11px] text-slate-400 font-medium">
              {notificaciones.length} {notificaciones.length === 1 ? "mensaje" : "mensajes"} en tu bandeja
            </p>
          </div>
          {notificaciones.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClearAllNotifs} 
              className="text-slate-400 hover:text-red-500 hover:bg-red-50" 
              title="Borrar todos"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-5 space-y-4">
        {selectedNotif && (
          <NotifDetailModal notif={selectedNotif} onClose={() => setSelectedNotif(null)} />
        )}

        {notificaciones.length > 0 ? (
          <div className="space-y-3">
            {notificaciones.map((notif) => (
              <SwipeableNotification 
                key={notif.id} 
                notif={notif} 
                onDelete={handleDeleteNotif} 
                onOpen={handleOpenNotif} 
              />
            ))}
          </div>
        ) : (
          <div className="bg-white p-10 rounded-3xl text-center space-y-3 border-2 border-dashed border-slate-200 mt-10 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <h3 className="font-bold text-slate-700">No hay mensajes</h3>
              <p className="text-sm text-slate-400 font-medium mt-1">
                Pronto recibirás promociones y alertas exclusivas aquí.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
