
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut, deleteUser } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection, query, orderBy, limit, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, Award, LogOut,
  User as UserIcon, Phone,
  QrCode, Edit2, Check, X, Trophy, Save,
  Smile, Cat, Dog, Coffee, Star, Store,
  MessageCircle, MapPin,
  Clock, Bell, CheckCircle2,
  ExternalLink, Sparkles,
  Calendar, FlaskConical, Navigation,
  LayoutDashboard, AlertTriangle, Trash2,
  Loader2, Info, MessageSquare, ChevronRight
} from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { registrarCompra } from "@/lib/puntos";
import { useToast } from "@/hooks/use-toast";
import { CatalogoPremios } from "./CatalogoPremios";
import PermissionsModal from "@/components/PermissionsModal";
import { cn } from "@/lib/utils";
import { PATIO_INFO } from "@/lib/data";
import Link from "next/link";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { registerFcmToken } from "@/lib/fcmTokenManager";
import { verificarYGenerarRecordatorioIA, procesarProximidadGeofence } from "@/lib/ai-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AVATAR_OPTIONS = [
  { id: 'User', icon: UserIcon, color: 'bg-slate-100 text-slate-600' },
  { id: 'Smile', icon: Smile, color: 'bg-yellow-100 text-yellow-600' },
  { id: 'Cat', icon: Cat, color: 'bg-orange-100 text-orange-600' },
  { id: 'Dog', icon: Dog, color: 'bg-blue-100 text-blue-600' },
  { id: 'Coffee', icon: Coffee, color: 'bg-amber-100 text-amber-800' },
  { id: 'Star', icon: Star, color: 'bg-purple-100 text-purple-600' },
];

function NotifDetailModal({ notif, onClose }: { notif: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla superior */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2" />

        {/* Cabecera */}
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

        {/* Título y fecha */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-800 leading-snug">{notif.titulo}</h2>
          <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-widest">
            {new Date(notif.fecha).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Cuerpo */}
        <p className="text-base text-slate-600 leading-relaxed">{notif.mensaje}</p>

        {/* Botón cerrar */}
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

function AcercaDeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla superior */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2" />

        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <Info className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Título y versión */}
        <div className="space-y-2">
          <h2 className="text-xl font-black leading-snug" style={{ color: "#4A4A4A" }}>
            Acerca de la App
          </h2>
          <span className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-400">
            v1.0.0
          </span>
        </div>

        {/* Separador */}
        <div className="h-px bg-slate-100 rounded-full" />

        {/* Botón de contacto */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Contacto</p>
          <a
            href="https://wa.me/56983568212"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg"
            style={{ backgroundColor: "#9DCC65", boxShadow: "0 4px 20px #9DCC6540" }}
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            Contacto para soporte o desarrollo
          </a>
        </div>

        {/* Firma */}
        <p className="text-center text-[11px] text-slate-300 font-light tracking-wide pt-2">
          Desarrollado por Ignacio Mateluna · 2026
        </p>
      </div>
    </div>
  );
}

function TerminosModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{ maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla superior */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

        {/* Cabecera fija */}
        <div className="px-8 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(211,182,115,0.15)", color: "#D3B673" }}>
              <Info className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 space-y-1">
            <h2 className="text-xl font-black leading-snug" style={{ color: "#4A4A4A" }}>
              Términos y Condiciones
            </h2>
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-400">
              Club Patio Curauma
            </span>
          </div>
        </div>

        {/* Separador */}
        <div className="h-px bg-slate-100 mx-8 shrink-0" />

        {/* Scroll */}
        <div className="overflow-y-auto px-8 py-5 space-y-5 flex-1">
          <TermSection title="1. Aceptación de los Términos">
            Al registrarse y utilizar la aplicación Club Patio Curauma (en adelante, <strong>"la App"</strong>), el usuario acepta estos Términos y Condiciones. Si no está de acuerdo, debe abstenerse de utilizar el servicio.
          </TermSection>
          <TermSection title="2. Descripción del Servicio">
            Club Patio Curauma es una plataforma de fidelización digital para digitalizar la experiencia de compra en Patio Curauma. La App permite:
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li>Acumular sellos digitales por compras en locales adheridos.</li>
              <li>Recibir sellos de bienvenida o bonos por inicio de sesión.</li>
              <li>Canjear sellos por recompensas y beneficios exclusivos.</li>
            </ul>
          </TermSection>
          <TermSection title="3. Registro y Privacidad">
            El usuario se compromete a proporcionar información real y precisa (Nombre, Email, Teléfono, Fecha de Nacimiento).
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Datos Personales:</strong> Usados para gestión de puntos, personalización y, si es aceptado, comunicaciones de marketing.</li>
              <li><strong>Seguridad:</strong> El usuario es responsable de mantener la confidencialidad de su cuenta.</li>
            </ul>
          </TermSection>
          <TermSection title="4. Sistema de Sellos y Recompensas">
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Sello de Bienvenida:</strong> Un (1) sello automático al registrarse, por única vez.</li>
              <li><strong>Bono de Inicio de Sesión:</strong> Un (1) sello extra por inicio de sesión, de única vez por usuario.</li>
              <li><strong>Acumulación:</strong> Sellos por compra otorgados exclusivamente por locatarios autorizados.</li>
              <li><strong>Valor:</strong> Los sellos no tienen valor monetario ni son transferibles.</li>
            </ul>
          </TermSection>
          <TermSection title="5. Canje y Vigencia">
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Ticket de Canje:</strong> Se genera al completar los sellos requeridos.</li>
              <li><strong>Vigencia:</strong> Cada ticket tiene validez máxima de <strong>48 horas</strong>. Expirado el plazo, el beneficio se pierde.</li>
              <li><strong>Validación:</strong> El beneficio se confirma cuando el locatario valida el ticket en el sistema.</li>
            </ul>
          </TermSection>
          <TermSection title="6. Uso Justo y Anti-Fraude">
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Cooldown:</strong> Máximo un sello por usuario cada <strong>12 horas</strong>.</li>
              <li><strong>Auditoría:</strong> La administración puede auditar registros. Actividad sospechosa resultará en suspensión de cuenta.</li>
            </ul>
          </TermSection>
          <TermSection title="7. Comunicaciones de Marketing">
            Al marcar la casilla correspondiente, el usuario acepta recibir ofertas y promociones vía email o WhatsApp.
          </TermSection>
          <TermSection title="8. Limitación de Responsabilidad">
            Club Patio Curauma actúa como intermediario tecnológico. La disponibilidad de premios es responsabilidad de cada local comercial.
          </TermSection>
          <TermSection title="9. Modificaciones">
            La administración se reserva el derecho de modificar estos términos informando a los usuarios a través de la App.
          </TermSection>
        </div>

        {/* Botón cerrar fijo */}
        <div className="px-8 py-5 shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98] shadow-lg"
            style={{ backgroundColor: "#D3B673", boxShadow: "0 4px 20px rgba(211,182,115,0.4)" }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function TermSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "#D3B673" }}>{title}</p>
      <div className="text-[13px] text-slate-600 leading-relaxed">{children}</div>
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
          <Card className={cn("border-none shadow-sm rounded-2xl overflow-hidden transition-all", notif.isAI ? "bg-gradient-to-br from-white to-primary/5 border-l-4 border-l-primary" : "bg-white")}>
            <CardContent className="p-4 flex gap-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", notif.isAI ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                {notif.isAI ? <Sparkles className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800">{notif.titulo}</h4>
                  <span className="text-[8px] text-slate-400 uppercase font-bold">{new Date(notif.fecha).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{notif.mensaje}</p>
              </div>
            </CardContent>
          </Card>
       </div>
    </div>
  );
}

interface UserProfileProps {
  onSwitchMode: () => void;
  onShowAuth: () => void;
}

export function UserProfile({ onShowAuth }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userData, setUserData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showPermisos, setShowPermisos] = useState(false);
  const { toast } = useToast();

  const [editForm, setEditForm] = useState({
    nombre: "",
    telefono: "",
    avatarId: "User",
    fechaNacimiento: "",
    nombreTienda: "",
    rubro: "",
    descripcion: "",
    whatsapp: "",
    instagram: "",
    ubicacionTienda: "",
    promoOptIn: false
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Guard: si no hay usuario autenticado, limpiamos el estado y salimos
    if (!user) {
      setUserData(null);
      setNotificaciones([]);
      return;
    }

    let unsubscribeDoc: (() => void) | undefined;
    let unsubscribeNotif: (() => void) | undefined;

    const userRef = doc(db, "usuarios", user.uid);
    unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setEditForm({
          nombre: data.nombre || "",
          telefono: data.telefono || "",
          avatarId: data.avatarId || "User",
          fechaNacimiento: data.fechaNacimiento || "",
          nombreTienda: data.nombreTienda || "",
          rubro: data.rubro || "",
          descripcion: data.descripcion || "",
          whatsapp: data.whatsapp || "",
          instagram: data.instagram || "",
          ubicacionTienda: data.ubicacionTienda || "",
          promoOptIn: data.promoOptIn || false
        });

        verificarYGenerarRecordatorioIA(user.uid, data.nombre, data.comprasRealizadas || 0);
      }
    });

    const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
    const qNotif = query(notifRef, orderBy("fecha", "desc"), limit(10));
    unsubscribeNotif = onSnapshot(
      qNotif,
      (snapshot) => {
        setNotificaciones(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        
        // Lanzar Notificación Push OS para alertas recién llegadas
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
             const data = change.doc.data();
             const ageEnMs = new Date().getTime() - new Date(data.fecha).getTime();
             // Evitamos spam de notificaciones antiguas al cargar la bbdd.
             // Solo si la notificación tiene menos de 10 segundos.
             if (ageEnMs < 10000 && !data.leida) {
                dispararAlertaSistema(data.titulo, data.mensaje);
             }
          }
        });
      },
      // onError: si Firestore devuelve permiso denegado (usuario ya cerró sesión)
      // simplemente ignoramos el error sin que rompa la app
      (error) => {
        if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
          console.warn("[Notificaciones] Listener detenido: sesión cerrada.");
        } else {
          console.error("[Notificaciones] Error inesperado:", error);
        }
      }
    );

    return () => {
      unsubscribeDoc?.();
      unsubscribeNotif?.();
    };
  }, [user]);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast({ title: "No compatible", description: "Tu navegador no soporta notificaciones." });
      return;
    }

    const token = await registerFcmToken();
    if (token) {
      setPushEnabled(true);
      toast({ title: "¡Alertas activadas!", description: "Recibirás notificaciones en tu celular." });
      dispararAlertaSistema("¡Club Patio activado!", "Gracias por habilitar las alertas.");
    } else if (Notification.permission === "denied") {
      toast({ variant: "destructive", title: "Permiso denegado", description: "Ve a Ajustes → Safari → Notificaciones y habilita Club Patio." });
    } else if (Notification.permission === "granted") {
      // Permiso OK pero fallo técnico (VAPID key no configurada en producción)
      toast({ variant: "destructive", title: "Error de configuración", description: "Notificaciones no disponibles aún. Intenta más tarde." });
    } else {
      toast({ variant: "destructive", title: "No disponible", description: "Instala la app en tu pantalla de inicio para activar notificaciones." });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", user.uid);
      const updateData: any = {
        nombre: editForm.nombre,
        telefono: editForm.telefono,
        avatarId: editForm.avatarId,
        fechaNacimiento: editForm.fechaNacimiento,
        promoOptIn: editForm.promoOptIn,
        updatedAt: new Date().toISOString()
      };

      if (userData?.rol === "emprendedor") {
        updateData.nombreTienda = editForm.nombreTienda;
        updateData.rubro = editForm.rubro;
        updateData.descripcion = editForm.descripcion;
        updateData.whatsapp = editForm.whatsapp;
        updateData.instagram = editForm.instagram;
        updateData.ubicacionTienda = editForm.ubicacionTienda;
      }

      await updateDoc(userRef, updateData);
      setIsEditing(false);
      toast({ title: "Perfil actualizado", description: "Tus datos se han guardado correctamente." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudieron actualizar los datos." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "usuarios", user.uid));
      await deleteUser(user);
      toast({ title: "Cuenta eliminada", description: "Lamentamos verte partir. Tus datos han sido borrados." });
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({ 
          variant: "destructive", 
          title: "Acción Protegida", 
          description: "Por seguridad, debes cerrar sesión y volver a entrar para confirmar la eliminación de tu cuenta." 
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: "No pudimos eliminar la cuenta. Inténtalo más tarde." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePurchase = async () => {
    if (!user) return;
    setLoading(true);
    await registrarCompra(db, user.uid);
    setLoading(false);
    toast({ title: "¡Sello Acumulado!", description: "Has sumado un sello a tu Club Patio." });
  };

  const handleTestGeofence = async () => {
    if (!user || !userData) return;
    setLoading(true);
    await procesarProximidadGeofence(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0, true);
    setLoading(false);
  };

  const handleForceAINotif = async () => {
    if (!user || !userData) return;
    setLoading(true);
    await verificarYGenerarRecordatorioIA(user.uid, userData.nombre || "Miembro", userData.comprasRealizadas || 0);
    setLoading(false);
  };

  const handleDeleteNotif = async (notifId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "usuarios", user.uid, "notificaciones", notifId));
    } catch (e) {}
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

  const handleLogout = async () => {
    await signOut(auth);
  };

  const renderAvatarIcon = (avatarId: string, className: string = "w-12 h-12") => {
    const option = AVATAR_OPTIONS.find(opt => opt.id === avatarId) || AVATAR_OPTIONS[0];
    const IconComponent = option.icon;
    return <IconComponent className={cn(className, option.color.split(' ')[1])} />;
  };

  if (!user) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center bg-white p-10 rounded-2xl border border-border shadow-sm text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">¡Bienvenido al Club Patio!</h2>
            <p className="text-muted-foreground px-4">Inicia sesión para acumular sellos y participar en nuestros sorteos exclusivos.</p>
          </div>
          <Button onClick={onShowAuth} className="w-full rounded-xl h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20">
            <UserIcon className="w-5 h-5" /> Entrar al Club
          </Button>
        </div>
      </div>
    );
  }

  const rol = userData?.rol || "cliente";
  const isAdmin = rol === "admin";
  const isEntrepreneur = rol === "emprendedor";
  const isDirector = rol === "director";
  const sellos = userData?.comprasRealizadas || 0;
  const tickets = userData?.ticketsSorteo || 0;
  const sellosEnTarjeta = sellos % 10 || (sellos > 0 && sellos % 10 === 0 ? 10 : 0);
  const sellosRestantesParaPremio = 5 - (sellos % 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className={cn("h-24 bg-gradient-to-r", isEntrepreneur ? "from-accent/30 to-primary/20" : isDirector ? "from-indigo-100 to-primary/20" : "from-primary/20 to-accent/20")} />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex justify-between items-end mb-4">
            <Avatar className="w-24 h-24 border-4 border-white shadow-md bg-white">
              <AvatarFallback className="flex items-center justify-center bg-white">
                {renderAvatarIcon(isEditing ? editForm.avatarId : (userData?.avatarId || 'User'), "w-10 h-10")}
              </AvatarFallback>
            </Avatar>
            {!isEditing ? (
              <Button variant="outline" size="sm" className="rounded-full border-primary/20 text-primary" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setIsEditing(false)}><X className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-primary">{userData?.nombre || "Usuario"}</h2>
              <Badge variant={isAdmin ? "destructive" : isDirector ? "secondary" : isEntrepreneur ? "default" : "outline"} className="text-[10px] font-bold uppercase">
                {isAdmin ? "Master Admin" : isDirector ? "Director de Patio" : isEntrepreneur ? "Emprendedor" : "Miembro Club"}
              </Badge>
            </div>
            {!isEditing && userData?.telefono && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                <Phone className="w-3 h-3" /> {userData.telefono}
              </p>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden animate-in slide-in-from-top duration-300">
          <CardHeader className="bg-slate-50 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-primary" /> Editar Mis Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Selecciona tu Avatar</Label>
              <div className="flex flex-wrap gap-3 justify-center">
                {AVATAR_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = editForm.avatarId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setEditForm({ ...editForm, avatarId: opt.id })}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        opt.color,
                        isSelected ? "ring-2 ring-primary ring-offset-2 scale-110 shadow-lg" : "opacity-40 grayscale-[50%] hover:opacity-100 hover:grayscale-0"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre Completo</Label>
                <Input
                  id="edit-nombre"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  placeholder="Tu nombre"
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-telefono">WhatsApp / Teléfono</Label>
                <Input
                  id="edit-telefono"
                  value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                  placeholder="+56 9 ..."
                  className="rounded-xl h-12"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleSaveProfile} 
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </Button>
          </CardContent>
        </Card>
      )}

      {isEditing && (
        <Card className="border-red-100 bg-red-50/30 rounded-2xl">
          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-xs font-bold uppercase">Zona de Peligro</p>
            </div>
            <p className="text-[11px] text-slate-500">¿Deseas eliminar permanentemente tu cuenta y todos tus sellos acumulados?</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full rounded-xl gap-2 font-bold h-10">
                  <Trash2 className="w-4 h-4" /> Eliminar mi cuenta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl max-w-[90%] md:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás totalmente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Perderás tus {sellos} sellos y el acceso a tus premios actuales.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2">
                  <AlertDialogCancel className="rounded-xl font-bold h-12">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-white rounded-xl font-bold h-12">Sí, eliminar cuenta</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {!pushEnabled && !isEditing && (
        <Card className="border-none shadow-md bg-blue-50/50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-blue-800">Recibe avisos al celular cuando pases cerca.</p>
            </div>
            <Button size="sm" onClick={requestNotificationPermission} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Activar</Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <section className="bg-slate-100/50 p-4 rounded-3xl border border-slate-200 border-dashed space-y-3">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <FlaskConical className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-widest">Zona de Pruebas (Admin Only)</h4>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handleTestGeofence} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Navigation className="w-3 h-3" /> Proximidad</Button>
            <Button onClick={handleForceAINotif} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Sparkles className="w-3 h-3" /> Generar IA</Button>
            <Button onClick={handleSimulatePurchase} size="sm" variant="outline" className="text-[9px] bg-white h-10 gap-1 font-bold"><Gift className="w-3 h-3" /> Sumar Sello</Button>
          </div>
        </section>
      )}

      {isDirector && (
        <section className="space-y-4 animate-in slide-in-from-bottom duration-500">
          <Card className="border-indigo-100 shadow-xl bg-white rounded-3xl overflow-hidden border-2">
            <CardHeader className="bg-indigo-50/50 pb-4">
              <CardTitle className="text-lg font-black flex items-center gap-2 text-indigo-900">
                <Trophy className="w-5 h-5 text-indigo-600" /> 
                Gestión Directiva
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Tienes acceso al panel de control global para monitorear la salud del recinto, gestionar premios y enviar comunicados.
                </p>
                <Link href="/director">
                  <Button className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg gap-3 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                    <LayoutDashboard className="w-6 h-6" /> 
                    Abrir Panel Directivo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {isEntrepreneur && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
          <Card className="border-accent/40 shadow-md bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-accent/10">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Store className="w-5 h-5" /> Mi Tienda
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <Link href="/vendedor?action=scan">
                <Button className="w-full h-16 rounded-3xl bg-primary text-white font-bold text-lg gap-3 shadow-lg shadow-primary/20">
                  <QrCode className="w-6 h-6" /> Escanear Cliente
                </Button>
              </Link>
              {/* Acceso rápido al Panel de Validación (handshake) */}
              {user && (
                <Link href={`/validar/${user.uid}`}>
                  <Button
                    className="w-full h-14 rounded-2xl font-bold gap-3 shadow-md active:scale-[0.97] transition-transform"
                    style={{ backgroundColor: "#D3B673", color: "#fff" }}
                  >
                    <span className="text-base">🛠️</span> Panel de Validación (Caja)
                  </Button>
                </Link>
              )}
              <Link href="/vendedor">
                <Button variant="outline" className="w-full h-14 rounded-2xl border-slate-200 bg-white text-slate-600 font-bold gap-3 hover:bg-slate-50">
                  <LayoutDashboard className="w-5 h-5 text-primary" /> Panel del Emprendedor
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {!isEntrepreneur && !isDirector && !isEditing && (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-primary">Mensajes del Club</h3>
              </div>
              {notificaciones.length > 0 && (
                <Button variant="ghost" size="icon" onClick={handleClearAllNotifs} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" title="Borrar todos">
                   <X className="w-5 h-5" />
                </Button>
              )}
            </div>
            {selectedNotif && (
              <NotifDetailModal notif={selectedNotif} onClose={() => setSelectedNotif(null)} />
            )}
            <div className="space-y-3">
              {notificaciones.length > 0 ? (
                notificaciones.map((notif) => (
                  <SwipeableNotification key={notif.id} notif={notif} onDelete={handleDeleteNotif} onOpen={setSelectedNotif} />
                ))
              ) : (
                <div className="bg-slate-50 p-8 rounded-3xl text-center space-y-2 border-2 border-dashed border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium italic">Pronto recibirás promociones exclusivas.</p>
                </div>
              )}
            </div>
          </section>

          <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden mt-6">
            <CardContent className="flex flex-col items-center py-8">
              <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-4">Muestra tu QR en caja para obtener sellos</p>
              <div className="p-4 bg-white border-2 border-primary/5 rounded-3xl shadow-inner flex items-center justify-center">
                <QRCode value={user.uid} size={176} fgColor="#000000" style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {showPermisos && <PermissionsModal onClose={() => setShowPermisos(false)} />}

      {/* ── Configuración de permisos ── */}
      <button
        onClick={() => setShowPermisos(true)}
        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(211,182,115,0.12)", color: "#D3B673" }}>
            <Bell className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Configuración de permisos</p>
            <p className="text-[11px] text-slate-400 font-medium">Notificaciones, ubicación y cámara</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </button>

      {/* FOOTER DE CUMPLIMIENTO APP STORE */}
      <section className="px-8 space-y-4 pt-6">
        <div className="flex flex-col gap-3">
          <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-primary transition-colors">
            POLÍTICA DE PRIVACIDAD <ExternalLink className="w-3 h-3" />
          </Link>
          <Link href="/terminos" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-primary transition-colors">
            TÉRMINOS Y CONDICIONES <ExternalLink className="w-3 h-3" />
          </Link>
          <Link href="/acerca" className="flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-primary transition-colors">
            ACERCA DE <Info className="w-3 h-3" />
          </Link>
        </div>
        <Separator className="bg-slate-100" />
        <div className="text-center">
          <Button onClick={handleLogout} variant="ghost" className="text-destructive font-bold text-xs gap-2"><LogOut className="w-4 h-4" /> Cerrar Sesión del Club</Button>
          <p className="text-[10px] text-slate-400 font-light mt-4">© {new Date().getFullYear()} {PATIO_INFO.name}</p>
        </div>
      </section>
    </div>
  );
}
