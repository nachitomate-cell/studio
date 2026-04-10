/**
 * firebase-messaging-sw.js
 * Service Worker dedicado a Firebase Cloud Messaging (FCM).
 * Maneja notificaciones push cuando la app está cerrada o en background.
 *
 * IMPORTANTE: Este archivo DEBE estar en /public para que Firebase lo
 * encuentre en la raíz del dominio.
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCGwNEBNmyrOl1mrpZhGNEktneNtxYgxj0",
  authDomain: "studio-7914495232-557f1.firebaseapp.com",
  projectId: "studio-7914495232-557f1",
  storageBucket: "studio-7914495232-557f1.firebasestorage.app",
  messagingSenderId: "120681935080",
  appId: "1:120681935080:web:d41757280ca888b46bd95d",
});

const messaging = firebase.messaging();

// Maneja mensajes recibidos cuando la app está en BACKGROUND o CERRADA
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje en background recibido:', payload);

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

// Al tocar la notificación — abre la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
