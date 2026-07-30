const CACHE_NAME = 'irec-v1-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Emergency SOS notification click listener with direct actions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;

  if (action === 'call_samu') {
    event.waitUntil(
      clients.openWindow('tel:192')
    );
    return;
  }

  if (action === 'open_upa') {
    event.waitUntil(
      clients.openWindow('https://www.google.com/maps/search/hospital+pronto+socorro+upa')
    );
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url && 'focus' in client) {
          client.navigate('/?sos=true');
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/?sos=true');
      }
    })
  );
});

// Auto re-create SOS notification if user accidentally swipes it away
self.addEventListener('notificationclose', (event) => {
  if (event.notification.tag === 'irec-sos-persistent-fixed') {
    self.registration.showNotification('🚨 SOS iRec - Atendimento & Emergência', {
      body: 'Toque para socorro imediato, ligar 192 ou rota da UPA mais próxima.',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: 'irec-sos-persistent-fixed',
      renotify: true,
      requireInteraction: true,
      priority: 'max',
      urgency: 'high',
      actions: [
        { action: 'call_samu', title: '📞 Ligar 192 (SAMU)' },
        { action: 'open_upa', title: '🏥 Rota UPA (Mapa)' }
      ]
    });
  }
});
