/**
 * firebase-messaging-sw.js — Service Worker único para Club Patio
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const CACHE_VERSION = '20';
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
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Club Patio Curauma';
  const body  = payload.notification?.body  || payload.data?.body  || '';

  // Guardamos solo el path ("/notificacion?id=ABC") para que notificationclick
  // siempre construya una URL same-origin y abra dentro de la PWA.
  let path = '/';
  try {
    const raw = payload.data?.url || '';
    if (raw) path = raw.startsWith('http') ? new URL(raw).pathname + new URL(raw).search : raw;
  } catch {}

  // Cerramos todas las notificaciones previas (incluida la auto de Firebase)
  self.registration.getNotifications().then(notifs => notifs.forEach(n => n.close()));

  return self.registration.showNotification(title, {
    body,
    icon: '/Logo2.png',
    badge: '/Logo2.png',
    vibrate: [200, 100, 200],
    tag: 'club-patio-push',
    data: { path },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const path = event.notification.data?.path || '/';
  const targetUrl = self.location.origin + path;

  // Async IIFE para poder usar await dentro de event.waitUntil
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = all.find(c => c.url.startsWith(self.location.origin));
    if (existing) {
      const focused = await existing.focus();
      if (focused && 'navigate' in focused) {
        await focused.navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
