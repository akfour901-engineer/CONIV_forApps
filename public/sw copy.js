importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');

workbox.setConfig({ debug: false });

const { precacheAndRoute } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { ExpirationPlugin } = workbox.expiration;
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const { RangeRequestsPlugin } = workbox.rangeRequests;
const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;

const VERSION = 'v11';  // bump version so old caches are cleared
const OFFLINE_PAGE = '/offline.html';

const CACHE_NAME_OFFLINE  = `coniv-offline-${VERSION}`;
const CACHE_NAME_STATIC   = `coniv-static-${VERSION}`;
const CACHE_NAME_IMAGES   = `coniv-images-${VERSION}`;
const CACHE_NAME_API      = `coniv-api-${VERSION}`;

// Precache only real URLs that return HTML/JSON/assets
precacheAndRoute([
  { url: OFFLINE_PAGE, revision: VERSION },
  { url: '/manifest.json', revision: VERSION },
  { url: '/', revision: VERSION },              // ← root route (app/page.tsx)
  { url: '/dashboard', revision: VERSION },     // ← add more like this if needed
  { url: '/icon-192x192.png', revision: VERSION },
  { url: '/icon-512x512.png', revision: VERSION },
  { url: '/icon-maskable.png', revision: VERSION },
], { cacheName: CACHE_NAME_OFFLINE });

// Install & activate
self.addEventListener('install', event => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => !key.includes(VERSION)).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Custom navigation handler (SPA offline fallback)
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse?.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME_OFFLINE).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        } catch (err) {
          const cached = await caches.match(event.request);
          if (cached) return cached;

          const offline = await caches.match(OFFLINE_PAGE);
          return offline || new Response(
            '<h1>Offline</h1><p>No connection. Try again later.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })()
    );
    return;
  }
  // Other requests fall through to Workbox routes below
});

// Static assets
registerRoute(
  ({ request }) => ['style', 'script', 'worker', 'font'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: CACHE_NAME_STATIC })
);

// Images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: CACHE_NAME_IMAGES,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new RangeRequestsPlugin(),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 5184000 }) // 60 days
    ]
  })
);

// API GET
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && event.request.method === 'GET',
  new NetworkFirst({
    cacheName: CACHE_NAME_API,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 600 })
    ]
  })
);

// Mutations with background sync
const bgSync = new BackgroundSyncPlugin('coniv-queue', { maxRetentionTime: 1440 });
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE'].includes(event.request.method),
  new NetworkFirst({ plugins: [bgSync] })
);

// Push (optional)
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'CONIV', {
      body: data.body || 'New update',
      icon: '/icon-192x192.png'
    })
  );
});