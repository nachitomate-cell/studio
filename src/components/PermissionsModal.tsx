"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Bell, MapPin, Camera, CheckCircle2, XCircle, AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { registerFcmToken } from "@/lib/fcmTokenManager";

interface PermissionsModalProps {
  onClose: () => void;
}

type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported" | "checking";

interface PermsState {
  notifications: PermissionStatus;
  location: PermissionStatus;
  camera: PermissionStatus;
}

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const INSTRUCTIONS: Record<keyof PermsState, Record<Platform, string>> = {
  notifications: {
    ios: "Ajustes → [Safari/Chrome] → Notificaciones → Activar",
    android: "Configuración → Aplicaciones → [Navegador] → Notificaciones → Activar",
    desktop: "Haz clic en el candado (barra de URL) → Notificaciones → Permitir",
  },
  location: {
    ios: 'Ajustes → Privacidad → Localización → [Navegador] → "Al usar la app"',
    android: "Configuración → Aplicaciones → [Navegador] → Permisos → Ubicación → Permitir",
    desktop: "Haz clic en el candado (barra de URL) → Ubicación → Permitir",
  },
  camera: {
    ios: "Ajustes → Privacidad → Cámara → [Navegador] → Activar",
    android: "Configuración → Aplicaciones → [Navegador] → Permisos → Cámara → Permitir",
    desktop: "Haz clic en el candado (barra de URL) → Cámara → Permitir",
  },
};

export default function PermissionsModal({ onClose }: PermissionsModalProps) {
  const [perms, setPerms] = useState<PermsState>({
    notifications: "checking",
    location: "checking",
    camera: "checking",
  });
  const [loading, setLoading] = useState<keyof PermsState | null>(null);
  const [platform] = useState<Platform>(() => detectPlatform());

  // Re-check notification permission (property-based, no event API)
  const recheckNotifications = useCallback(() => {
    if (!("Notification" in window)) {
      setPerms((p) => ({ ...p, notifications: "unsupported" }));
    } else {
      setPerms((p) => ({ ...p, notifications: Notification.permission as PermissionStatus }));
    }
  }, []);

  // Initial setup: read current states + register change listeners (once)
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    recheckNotifications();

    if (!("permissions" in navigator)) {
      setPerms((p) => ({ ...p, location: "prompt", camera: "prompt" }));
      return;
    }

    const setup = async () => {
      // Geolocation
      try {
        const geo = await navigator.permissions.query({ name: "geolocation" });
        setPerms((p) => ({ ...p, location: geo.state as PermissionStatus }));
        const onGeo = () => setPerms((p) => ({ ...p, location: geo.state as PermissionStatus }));
        geo.addEventListener("change", onGeo);
        cleanups.push(() => geo.removeEventListener("change", onGeo));
      } catch {
        setPerms((p) => ({ ...p, location: "unsupported" }));
      }

      // Camera
      try {
        const cam = await navigator.permissions.query({ name: "camera" as PermissionName });
        setPerms((p) => ({ ...p, camera: cam.state as PermissionStatus }));
        const onCam = () => setPerms((p) => ({ ...p, camera: cam.state as PermissionStatus }));
        cam.addEventListener("change", onCam);
        cleanups.push(() => cam.removeEventListener("change", onCam));
      } catch {
        setPerms((p) => ({ ...p, camera: "prompt" }));
      }
    };

    setup();
    return () => cleanups.forEach((fn) => fn());
  }, [recheckNotifications]);

  // Re-check notification status when user returns from device settings
  // (location/camera auto-update via their permission change listeners)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") recheckNotifications();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [recheckNotifications]);

  const requestNotifications = async () => {
    setLoading("notifications");
    try {
      // registerFcmToken handles requestPermission + FCM token save in one call
      await registerFcmToken();
    } finally {
      // Read the actual permission state regardless of FCM result
      recheckNotifications();
      setLoading(null);
    }
  };

  const requestLocation = () => {
    setLoading("location");
    navigator.geolocation.getCurrentPosition(
      () => { setPerms((p) => ({ ...p, location: "granted" })); setLoading(null); },
      () => { setPerms((p) => ({ ...p, location: "denied" })); setLoading(null); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const requestCamera = async () => {
    setLoading("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPerms((p) => ({ ...p, camera: "granted" }));
    } catch {
      setPerms((p) => ({ ...p, camera: "denied" }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

        <div className="px-8 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">Permisos de la App</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Gestiona los accesos del dispositivo
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-100 mx-8 shrink-0" />

        <div className="overflow-y-auto px-8 py-5 space-y-4 flex-1">
          <PermRow
            icon={<Bell className="w-5 h-5" />}
            name="Notificaciones"
            description="Avisos de sellos, premios y promociones"
            status={perms.notifications}
            loading={loading === "notifications"}
            onRequest={requestNotifications}
            instructions={INSTRUCTIONS.notifications[platform]}
            canReactivate
          />

          <PermRow
            icon={<MapPin className="w-5 h-5" />}
            name="Ubicación"
            description="Detectar si estás cerca de Patio Curauma"
            status={perms.location}
            loading={loading === "location"}
            onRequest={requestLocation}
            instructions={INSTRUCTIONS.location[platform]}
          />

          <PermRow
            icon={<Camera className="w-5 h-5" />}
            name="Cámara"
            description="Escanear códigos QR en los locales"
            status={perms.camera}
            loading={loading === "camera"}
            onRequest={requestCamera}
            instructions={INSTRUCTIONS.camera[platform]}
          />
        </div>

        <div className="px-8 py-5 shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: "#D3B673" }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PermissionStatus }) {
  if (status === "checking") {
    return <span className="text-[11px] font-bold text-slate-400">Verificando…</span>;
  }
  if (status === "granted") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#9DCC65" }}>
        <CheckCircle2 className="w-3.5 h-3.5" /> Activado
      </span>
    );
  }
  if (status === "denied") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-red-500">
        <XCircle className="w-3.5 h-3.5" /> Bloqueado
      </span>
    );
  }
  if (status === "unsupported") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
        <AlertTriangle className="w-3.5 h-3.5" /> No disponible
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
      <AlertTriangle className="w-3.5 h-3.5" /> Sin configurar
    </span>
  );
}

function PermRow({
  icon,
  name,
  description,
  status,
  loading,
  onRequest,
  instructions,
  canReactivate = false,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: PermissionStatus;
  loading: boolean;
  onRequest: () => void;
  instructions: string;
  canReactivate?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor:
              status === "granted"
                ? "rgba(157,204,101,0.12)"
                : status === "denied"
                ? "rgba(239,68,68,0.08)"
                : "rgba(211,182,115,0.12)",
            color:
              status === "granted"
                ? "#9DCC65"
                : status === "denied"
                ? "#ef4444"
                : "#D3B673",
          }}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">{name}</p>
          <p className="text-[11px] text-slate-400 font-medium leading-snug">{description}</p>
        </div>

        <StatusBadge status={status} />
      </div>

      {status === "prompt" && (
        <div className="px-4 pb-4">
          <button
            onClick={onRequest}
            disabled={loading}
            className="w-full h-9 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] disabled:opacity-60"
            style={{ backgroundColor: "#D3B673" }}
          >
            {loading ? "Solicitando…" : <><span>Activar</span><ChevronRight className="w-3.5 h-3.5" /></>}
          </button>
        </div>
      )}

      {status === "granted" && canReactivate && (
        <div className="px-4 pb-4">
          <button
            onClick={onRequest}
            disabled={loading}
            className="w-full h-9 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] disabled:opacity-60 hover:bg-slate-50"
          >
            {loading ? "Actualizando…" : <><RefreshCw className="w-3.5 h-3.5" /><span>Reactivar notificaciones</span></>}
          </button>
        </div>
      )}

      {status === "denied" && (
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={onRequest}
            disabled={loading}
            className="w-full h-9 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] disabled:opacity-60"
            style={{ backgroundColor: "#D3B673" }}
          >
            {loading ? "Verificando…" : <><span>Ya lo activé — verificar</span><ChevronRight className="w-3.5 h-3.5" /></>}
          </button>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Permiso bloqueado. Actívalo desde:
          </p>
          <div className="bg-slate-50 rounded-xl px-3 py-2">
            <p className="text-[11px] font-bold text-slate-600">{instructions}</p>
          </div>
          <p className="text-[10px] text-slate-400">
            Luego vuelve a la app — el estado se actualizará solo.
          </p>
        </div>
      )}
    </div>
  );
}
