/**
 * Service Worker — FANISA Collecte Terrain
 * Cache statique pour fonctionnement offline complet.
 */
const CACHE = 'fanisa-collecte-v1';

// Ressources à mettre en cache lors de l'installation
const PRECACHE = [
  '/collecte',
  '/collecte/',
  '/collecte/index.html',
  '/collecte.webmanifest',
  '/icon-collecte-192.png',
  '/icon-collecte-512.png',
  // Polices Google (cache runtime)
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;

  // Supabase et APIs : réseau uniquement
  if (url.includes('.supabase.co') || url.includes('/api/')) {
    return;
  }

  // Google Fonts : cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE + '-fonts').then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          if (cached) return cached;
          return fetch(e.request).then(function (resp) {
            if (resp.ok) cache.put(e.request, resp.clone());
            return resp;
          }).catch(function () { return cached || new Response('', { status: 503 }); });
        });
      })
    );
    return;
  }

  // Navigation vers /collecte : cache-first avec fallback réseau
  if (e.request.mode === 'navigate' && url.includes('/collecte')) {
    e.respondWith(
      caches.match('/collecte/index.html').then(function (cached) {
        return cached || fetch(e.request);
      })
    );
    return;
  }

  // Tout le reste : network-first, cache en fallback
  e.respondWith(
    fetch(e.request).then(function (resp) {
      if (resp.ok && e.request.method === 'GET') {
        var clone = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      }
      return resp;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
