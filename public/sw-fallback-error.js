// sw-fallback-error.js – Only for HTTP error codes (400–599), NOT for offline

const ERROR_CACHE_NAME = 'coniv-error-fallback-v1';
const ERROR_FALLBACK_PAGE = '/fallback-error.html';

// Cache error page on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(ERROR_CACHE_NAME).then(cache => cache.add(ERROR_FALLBACK_PAGE))
  );
});

// Intercept only bad responses (NOT offline/network failure)
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).then(response => {
      // Only replace if status is error (400–599)
      if (response && !response.ok && response.status >= 400 && response.status < 600) {
       
        return caches.match(ERROR_FALLBACK_PAGE);
      }
      // Good response (200–299) or redirect → pass through
      return response;
    })
    // Important: NO .catch() here!
    // Network failure/offline is handled by sw-splash-offline.js
  );
});