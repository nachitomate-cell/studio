/**
 * firebase-messaging-sw.js — Service Worker único para Club Patio
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const CACHE_VERSION = '10';
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
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  if (SHELL_ASSETS.some(a => url.pathname === a || url.pathname.endsWith(a))) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
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
  console.log('[SW] onBackgroundMessage payload:', JSON.stringify(payload));

  const title = payload.notification?.title || payload.data?.title || 'Club Patio';
  const body  = payload.notification?.body  || payload.data?.body  || '';
  const url   = payload.data?.url || '/';

  // Cerrar la notificación que Firebase ya mostró (tiene FCM_MSG, causaría el bloqueo)
  self.registration.getNotifications().then(notifs => {
    notifs.forEach(n => {
      if (n.data && n.data.FCM_MSG) {
        console.log('[SW] Cerrando notificación de Firebase (FCM_MSG)');
        n.close();
      }
    });
  });

  // Mostrar nuestra notificación con data: { url } — sin FCM_MSG
  self.registration.showNotification(title, {
    body,
    icon: '/Logo.png',
    badge: '/Logo.png',
    vibrate: [200, 100, 200],
    tag: 'club-patio-broadcast',
    renotify: true,
    data: { url },
  });
});

// Firebase retorna early de su notificationclick cuando no encuentra FCM_MSG en data.
// Por lo tanto, este listener corre sin interferencia.
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] notificationclick url:', event.notification.data?.url);
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
