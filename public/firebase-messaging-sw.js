/**
 * firebase-messaging-sw.js — Service Worker único para Club Patio
 *
 * Maneja:
 *   - Notificaciones push FCM en background/app cerrada (Firebase Messaging)
 *   - Ciclo de vida PWA (install, activate)
 *   - Click en notificación → abre la app
 *
 * DEBE estar en /public/ (raíz del dominio) para que Firebase lo encuentre.
 * Es el único SW registrado — no usar sw.js en paralelo (conflicto de scope en iOS).
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// ── Ciclo de vida PWA ─────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activo');
  event.waitUntil(self.clients.claim());
});

// ── Firebase Messaging ────────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyCGwNEBNmyrOl1mrpZhGNEktneNtxYgxj0",
  authDomain: "studio-7914495232-557f1.firebaseapp.com",
  projectId: "studio-7914495232-557f1",
  storageBucket: "studio-7914495232-557f1.firebasestorage.app",
  messagingSenderId: "120681935080",
  appId: "1:120681935080:web:d41757280ca888b46bd95d",
});

const messaging = firebase.messaging();

// Mensajes en background o con app cerrada
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje FCM en background:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Club Patio';
  const body  = payload.notification?.body  || payload.data?.body  || 'Tienes un nuevo mensaje.';

  self.registration.showNotification(title, {
    body,
    icon: '/Logo.png',
    badge: '/Logo.png',
    vibrate: [100, 50, 100],
    data: { url: payload.data?.url || '/' },
  });
});

// ── Click en notificación → abrir/enfocar la app ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
