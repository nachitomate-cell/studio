"use client";

/**
 * Lo que la app de las tiendas (Capacitor) hace al abrirse y al volver:
 *  - Geopush: baja zonas y textos, los registra en el teléfono y sube la bitácora.
 *  - Push nativo: refresca el token FCM si el permiso ya está dado (sin pedirlo),
 *    crea los canales de Android que usa el servidor y abre la ruta al tocar.
 *
 * En el navegador / PWA no hace nada.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { esAppNativa, plataformaNativa } from "@/lib/nativo";

function rutaInterna(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    if (url.startsWith("/")) return url;
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

export function useAppNativa() {
  const router = useRouter();

  useEffect(() => {
    if (!esAppNativa()) return;
    let vivo = true;
    let usuario: User | null = auth.currentUser;
    const limpiezas: (() => void)[] = [];

    const sincronizar = async () => {
      const { sincronizarGeoPush } = await import("@/lib/geopush");
      await sincronizarGeoPush(usuario);
      await refrescarTokenPush();
    };

    const refrescarTokenPush = async () => {
      try {
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        const { receive } = await FirebaseMessaging.checkPermissions();
        const { fijarEstadoPushNativo } = await import("@/lib/pushSoporte");
        fijarEstadoPushNativo(receive === "granted" ? "concedido" : receive === "denied" ? "denegado" : "preguntable");
        if (receive !== "granted") return;
        const { token } = await FirebaseMessaging.getToken();
        if (token && usuario) {
          const { guardarTokenNativo } = await import("@/lib/fcmTokenManager");
          await guardarTokenNativo(token);
        }
      } catch (e) {
        console.warn("[App] No se pudo refrescar el token de push:", e);
      }
    };

    (async () => {
      // Canales de Android que el servidor nombra al enviar (campañas y avisos).
      if (plataformaNativa() === "android") {
        try {
          const { FirebaseMessaging, Importance } = await import("@capacitor-firebase/messaging");
          await FirebaseMessaging.createChannel({ id: "club_patio_marketing", name: "Promociones y premios", importance: Importance.High });
          await FirebaseMessaging.createChannel({ id: "club_patio_default", name: "Sellos y canjes", importance: Importance.High });
        } catch {}
      }

      // Toques: abrir la ruta del aviso.
      try {
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        const h1 = await FirebaseMessaging.addListener("notificationActionPerformed", (ev) => {
          const d: any = ev.notification?.data ?? {};
          const ruta = rutaInterna(d.url) ?? rutaInterna(d.cta);
          if (ruta) router.push(ruta);
        });
        const h2 = await FirebaseMessaging.addListener("tokenReceived", async ({ token }) => {
          const { guardarTokenNativo } = await import("@/lib/fcmTokenManager");
          await guardarTokenNativo(token);
        });
        limpiezas.push(() => { h1.remove(); h2.remove(); });
      } catch {}

      try {
        const { GeoPush, urlDeZona, obtenerConfig } = await import("@/lib/geopush");
        // Android: el toque llega por el plugin propio.
        const h = await GeoPush.addListener("toque", async ({ zona }) => {
          await obtenerConfig();
          router.push(urlDeZona(zona));
        });
        limpiezas.push(() => h.remove());
      } catch {}
      try {
        // iOS: el aviso es una notificación local; el toque llega por este plugin.
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const h = await LocalNotifications.addListener("localNotificationActionPerformed", async (ev) => {
          const zona = (ev.notification?.extra as any)?.geopushZona;
          if (!zona) return;
          const { urlDeZona, obtenerConfig } = await import("@/lib/geopush");
          await obtenerConfig();
          router.push(urlDeZona(zona));
        });
        limpiezas.push(() => h.remove());
      } catch {}

      if (vivo) sincronizar();
    })();

    const unsub = onAuthStateChanged(auth, (u) => {
      const cambio = u?.uid !== usuario?.uid;
      usuario = u;
      if (cambio && u) sincronizar();
    });
    const alVolver = () => {
      if (document.visibilityState === "visible") sincronizar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      vivo = false;
      unsub();
      document.removeEventListener("visibilitychange", alVolver);
      limpiezas.forEach((f) => f());
    };
  }, [router]);
}
