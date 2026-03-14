// sw-offline.js – Splash on first online load + offline fallback

const CACHE_NAME       = 'coniv-splash-offline-v5';
const SPLASH_PAGE      = '/splash.html';     // online first-load splash
const OFFLINE_PAGE     = '/offline.html';    // real offline screen
const FIRST_LOAD_FLAG  = '/first-load-flag.txt'; // dummy marker file

self.addEventListener('install', event => {
 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        SPLASH_PAGE,
        OFFLINE_PAGE,
        FIRST_LOAD_FLAG,   // empty dummy file – just existence matters
        '/',
        '/dashboard'
      ]);
    }).catch(err => console.error('Precache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
 
  event.waitUntil(self.clients.claim());
});

// Main fetch logic – segregated splash vs offline
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    (async () => {
      // Check if this is first-ever load (flag missing)
      const cache = await caches.open(CACHE_NAME);
      const hasFlag = await cache.match(FIRST_LOAD_FLAG);

      try {
        // Try network first (online case)
        const networkResp = await fetch(event.request);

        // Success → cache real page
        if (networkResp && networkResp.status === 200) {
          const clone = networkResp.clone();
          cache.put(event.request, clone);
        }

        // If first load (no flag) → show splash (which redirects after 2s)
        if (!hasFlag) {
         
          // Set flag so next load skips splash
          cache.put(FIRST_LOAD_FLAG, new Response('loaded', { status: 200 }));
          return caches.match(SPLASH_PAGE);
        }

        // Not first load → serve real content
       
        return networkResp;

      } catch (err) {
        // Network failed → offline
       
        return caches.match(OFFLINE_PAGE);
      }
    })()
  );
});