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

// ── Cache offline ─────────────────────────────────────────────────────────────
// IMPORTANTE: incrementar CACHE_VERSION en cada deploy significativo para
// forzar que los navegadores descarten el caché anterior y descarguen el nuevo SW.
const CACHE_VERSION = '3';
const CACHE_NAME = `club-patio-shell-v${CACHE_VERSION}`;

// Solo se cachean assets del shell de la app (imágenes, manifest).
// Los bundles JS/CSS de Next.js NO se cachean aquí — Next.js usa hashes de
// contenido en sus filenames (_next/static/…), el browser los gestiona
// automáticamente. Cachearlos en el SW causaba que PC sirviera JS antiguo.
const SHELL_ASSETS = ['/Logo.png', '/Logo2.png', '/manifest.json'];

// ── Ciclo de vida PWA ─────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalado v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  // skipWaiting: el nuevo SW toma control inmediatamente sin esperar que
  // cierren todas las pestañas. Junto con clients.claim(), garantiza que
  // los usuarios vean la nueva versión sin refrescar manualmente.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activo v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // Eliminar TODOS los cachés con nombre distinto al actual.
        // Al cambiar CACHE_VERSION, esto limpia el caché viejo automáticamente.
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Eliminando caché obsoleto:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Estrategia fetch ──────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Ignorar peticiones a dominios externos (Firebase, CDN, etc.)
  if (url.hostname !== self.location.hostname) return;

  // 2. CRÍTICO: NO interceptar bundles de Next.js (_next/static/, _next/image, etc.)
  //    Next.js genera hashes únicos por contenido — el browser los cachea de forma
  //    óptima. Interceptarlos con cache-first fue la causa de que PC sirviera JS antiguo.
  if (url.pathname.startsWith('/_next/')) return;

  // 3. Navegación (páginas HTML): network-first
  //    Siempre intenta obtener el HTML fresco del servidor. Solo usa caché como fallback
  //    offline. Esto garantiza que los cambios de routing se reflejen de inmediato.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/'))
        )
    );
    return;
  }

  // 4. Shell assets (logos, manifest): cache-first, network fallback
  //    Estos archivos cambian rara vez y se sirven rápido desde caché.
  if (SHELL_ASSETS.some(a => url.pathname === a || url.pathname.endsWith(a))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // 5. Todo lo demás: no interceptar — el browser aplica su caché HTTP normal
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
    vibrate: [200, 100, 200, 100, 200],
    // Tag único para que cada notificación se muestre independientemente.
    // Si se usara un tag fijo, FCM podría reemplazar/descartar la anterior.
    tag: 'club-patio-' + Date.now(),
    renotify: true,
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
