const CACHE_NAME = 'handball-stats-pro-v4-offline';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './index.css',
  './manifest.json',
  './assets/icon-512.png',
  './assets/icon-192.png'
  // Todos los recursos JS/CSS se cargan a través de Vite y se cachearán dinámicamente
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Abriendo caché y guardando recursos esenciales');
        return cache.addAll(URLS_TO_CACHE).catch(err => {
          console.warn('Algunos recursos no se pudieron cachear (posiblemente las imágenes si no existen aún):', err);
        });
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devolver desde caché si existe
        if (response) {
          return response;
        }

        // Si no está en caché, hacer fetch y cachear la respuesta
        return fetch(event.request).then(response => {
          // Solo cachear respuestas exitosas
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Cachear recursos locales
          if (event.request.url.startsWith(self.location.origin)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }

          return response;
        }).catch(() => {
          // Si falla el fetch, intentar devolver desde caché
          return caches.match(event.request);
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});