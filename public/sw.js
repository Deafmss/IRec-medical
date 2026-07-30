const CACHE_NAME = 'irec-v3-network-first';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Clear all old stale caches
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// Network First strategy: Always get latest build files from Vercel network first
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Emergency SOS notification click listener
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
