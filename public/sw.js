// Versão do cache. **Precisa mudar a cada deploy** — o `activate` apaga todo
// cache cujo nome não seja este. Enquanto o nome ficou fixo em 'irec-v1-cache',
// o /index.html gravado no primeiro install nunca era revalidado, e ele aponta
// para hashes de asset que desaparecem no deploy seguinte: tela branca offline.
const CACHE_VERSION = 'v2-2026-08-21';
const CACHE_NAME = `irec-${CACHE_VERSION}`;

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png'
];

const SOS_TAG = 'irec-sos-persistent-fixed';

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

/**
 * Abre o app numa URL e traz a aba para frente, reaproveitando uma janela já
 * aberta quando existir.
 */
const openApp = (path) =>
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) {
        if ('navigate' in client) {
          return client.navigate(path).then((navigated) => (navigated || client).focus());
        }
        return client.focus();
      }
    }
    return self.clients.openWindow(path);
  });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // `clients.openWindow` só aceita http/https. O `openWindow('tel:192')` que
  // estava aqui não fazia nada — o botão de emergência da notificação não
  // discava. A discagem tem de acontecer no contexto da página, onde
  // `window.location.href = 'tel:...'` funciona (SOSEmergencyModal já faz isso).
  if (event.action === 'call_samu') {
    event.waitUntil(openApp('/?sos=true&discar=192'));
    return;
  }

  if (event.action === 'open_upa') {
    event.waitUntil(
      self.clients.openWindow('https://www.google.com/maps/search/hospital+pronto+socorro+upa')
    );
    return;
  }

  event.waitUntil(openApp('/?sos=true'));
});

// A versão anterior recriava a notificação de SOS dentro do próprio
// `notificationclose`. Combinado com `requireInteraction: true`, isso deixava o
// usuário sem nenhuma forma de dispensá-la: fechar disparava o evento, que
// mostrava outra, que ao ser fechada disparava o evento outra vez. Laço infinito.
//
// Fechar uma notificação é uma escolha explícita do usuário e tem de ser
// respeitada. Quem decide se o alerta continua é a página (que sabe se a
// emergência ainda está ativa), via postMessage.
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'IREC_SOS_SHOW') {
    self.registration.showNotification('🚨 SOS iRec - Atendimento & Emergência', {
      body: 'Toque para socorro imediato, ligar 192 ou rota da UPA mais próxima.',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: SOS_TAG,
      renotify: false,
      requireInteraction: true,
      actions: [
        { action: 'call_samu', title: '📞 Ligar 192 (SAMU)' },
        { action: 'open_upa', title: '🏥 Rota UPA (Mapa)' }
      ]
    });
    return;
  }

  if (data.type === 'IREC_SOS_DISMISS') {
    self.registration.getNotifications({ tag: SOS_TAG }).then((list) => {
      list.forEach((n) => n.close());
    });
  }
});
