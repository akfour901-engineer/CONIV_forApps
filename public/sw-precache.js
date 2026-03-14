// sw-precache.js – Cache important app pages & assets for offline use

const PRECACHE_NAME = 'coniv-precache-v1';

// List of URLs to cache during install (add your most-used pages here)
const PRECACHE_URLS = [
  '/',                    // home / landing
  '/dashboard',           // main dashboard
  '/dashboard/estimates', // example – add your real routes
  '/dashboard/work-orders',
  '/dashboard/invoices',
  '/manifest.json',       // important for PWA install
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable.png'
];

self.addEventListener('install', event => {

  
  event.waitUntil(
    caches.open(PRECACHE_NAME).then(cache => {
      
      return cache.addAll(PRECACHE_URLS);
    }).catch(err => {
     
    })
  );
});

// Optional: clean old precache on activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key.startsWith('coniv-precache-') && key !== PRECACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});

// Serve from precache for navigations when offline (fallback to offline.html already handled in sw-splash-offline.js)