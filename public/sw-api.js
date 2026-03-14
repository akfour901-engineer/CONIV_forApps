// sw-api.js – Network-first API + background sync for mutations

const API_CACHE = 'coniv-api-get-v1';

workbox.routing.registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new workbox.strategies.NetworkFirst({
    cacheName: API_CACHE,
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 10 * 60,
        purgeOnQuotaError: true
      })
    ],
    networkTimeoutSeconds: 6
  })
);

const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('coniv-mutations-queue', {
  maxRetentionTime: 24 * 60
});

workbox.routing.registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE'].includes(request.method),
  new workbox.strategies.NetworkOnly({ plugins: [bgSyncPlugin] })
);

