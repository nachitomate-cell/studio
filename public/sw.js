
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
    icon: 'https://picsum.photos/seed/patio-icon/192/192',
    badge: 'https://picsum.photos/seed/patio-icon/192/192',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Al hacer clic en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
