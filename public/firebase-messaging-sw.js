/**
 * firebase-messaging-sw.js — Service Worker único para Club Patio
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const CACHE_VERSION = '18';
const CACHE_NAME = `club-patio-shell-v${CACHE_VERSION}`;
const SHELL_ASSETS = ['/Logo.png', '/Logo2.png', '/manifest.json'];

self.addEventListener('install', (event) => {
  console.log('[SW] Instalado v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activo v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/_next/')) return;

  if (request.mode === 'navigate') {
    // iOS PWA restaura la última URL al reabrir la app desde el home screen.
    // Si esa URL era /emprendedor/[id] y no viene de una navegación interna
    // (referrer vacío = entrada directa o restauración), redirigimos al home.
    // Navegación interna (SPA) no pasa por el SW, por lo que no se ve afectada.
    const isEmprendedorPath = url.pathname.startsWith('/emprendedor/');
    const isDirectEntry = !request.referrer || request.referrer === '';
    if (isEmprendedorPath && isDirectEntry) {
      event.respondWith(Response.redirect(self.location.origin + '/', 302));
      return;
    }

    // No cachear HTML de páginas — siempre desde la red para evitar servir
    // versiones rotas en deploys futuros. Fallback al root solo si offline.
    event.respondWith(
      fetch(request).catch(() => caches.match('/') || fetch('/'))
    );
    return;
  }

  if (SHELL_ASSETS.some(a => url.pathname === a || url.pathname.endsWith(a))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, responseToCache));
          }
          return response;
        });
      })
    );
  }
});

// ── Firebase Messaging ────────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyCGwNEBNmyrOl1mrpZhGNEktneNtxYgxj0",
  authDomain: "studio-7914495232-557f1.firebaseapp.com",
  projectId: "studio-7914495232-557f1",
  storageBucket: "studio-7914495232-557f1.firebasestorage.app",
  messagingSenderId: "120681935080",
  appId: "1:120681935080:web:d41757280ca888b46bd95d"
});

const messaging = firebase.messaging();

// Cuando llega un push en background, el SDK de Firebase:
//   1. Muestra la notificación automáticamente con data: { FCM_MSG: internalPayload }
//   2. Luego llama a este handler (onBackgroundMessage)
//
// El problema: la notificación de Firebase (paso 1) tiene FCM_MSG en data, lo que hace
// que su notificationclick handler llame stopImmediatePropagation() bloqueando el nuestro.
//
// Solución: cerramos la notificación de Firebase y mostramos la nuestra con data: { url }.
// Firebase's notificationclick ve que no hay FCM_MSG → retorna early SIN bloquear el nuestro.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Club Patio';
  const body  = payload.notification?.body  || payload.data?.body  || '';
  const tipo  = payload.data?.type || '';
  const cta   = payload.data?.cta  || '/';

  // Cerrar la notificación automática de Firebase (tiene FCM_MSG, bloquearía el click handler)
  self.registration.getNotifications().then(notifs => {
    notifs.forEach(n => { if (n.data?.FCM_MSG) n.close(); });
  });

  // Mostrar nuestra notificación con data limpia (sin FCM_MSG)
  self.registration.showNotification(title, {
    body,
    icon: '/Logo.png',
    badge: '/Logo.png',
    vibrate: [200, 100, 200],
    tag: 'club-patio-broadcast',
    renotify: true,
    data: { tipo, cta },
  });
});

// Firebase retorna early de su notificationclick cuando no encuentra FCM_MSG → este corre sin interferencia
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { tipo = '', cta = '/' } = event.notification.data || {};

  // Si la notificación tiene un destino específico, navegar directo; si no, pasar params para modal
  const params = new URLSearchParams({
    n_t: event.notification.title || '',
    n_b: event.notification.body  || '',
    n_tipo: tipo,
    n_cta: cta,
  });
  const targetUrl = (cta && cta !== '/')
    ? self.location.origin + cta
    : self.location.origin + '/?' + params.toString();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Navegar en la ventana PWA ya abierta si existe
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(targetUrl);
        }
      }
      // Si la app no estaba abierta, abrir nueva ventana
      return self.clients.openWindow(targetUrl);
    })
  );
});
