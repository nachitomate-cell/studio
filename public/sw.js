
/**
 * Service Worker - Club Patio Curauma
 * Este archivo permite que la app funcione como PWA y maneje notificaciones.
 */

self.addEventListener('install', (event) => {
  console.log('SW: Instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activo');
  return self.clients.claim();
});

// Listener para notificaciones reales (Push API)
// Nota: Requiere un servidor para disparar el evento
self.addEventListener('push', (event) => {
  let data = { title: 'Club Patio', body: 'Tienes una nueva actualización.' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Club Patio', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/Logo3.png',
    badge: '/Logo3.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'club-patio',
    renotify: true,
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Al hacer clic en la notificación
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
