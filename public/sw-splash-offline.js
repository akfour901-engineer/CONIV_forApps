// public/sw-splash-offline.js – Fixed: Splash ONLY on first root load, no loop, clean offline fallback

const CACHE_NAME       = 'coniv-cover-v8';           // Bump version to clear old caches
const SPLASH_PAGE      = '/splash.html';             // 2-second splash screen
const OFFLINE_PAGE     = '/offline.html';            // real offline page
const SPLASH_SHOWN_KEY = '/splash-shown-flag';       // flag to prevent repeated splash

self.addEventListener('install', event => {
  
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        SPLASH_PAGE,
        OFFLINE_PAGE,
        '/',              // root – where splash can trigger
        '/home',          // safe entry after splash (your new route)
        '/dashboard'      // main authenticated page
      ]);
    }).catch(err => {
      
    })
  );
  
  self.skipWaiting(); // activate immediately
});

self.addEventListener('activate', event => {

  event.waitUntil(self.clients.claim());
});

// Smart fetch handler: splash only once on root, then real pages
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const splashAlreadyShown = await cache.match(SPLASH_SHOWN_KEY);

      try {
        // Quick online check (HEAD is fast & reliable)
        const test = await fetch(event.request, { 
          method: 'HEAD', 
          cache: 'no-store',
          mode: 'no-cors'
        });

        if (test.ok) {
          // Online

          // Serve splash ONLY on root AND if not already shown once
          if ((pathname === '/' || pathname === '') && !splashAlreadyShown) {
           
            // Mark as shown → next time skip splash forever (until cache clear)
            cache.put(SPLASH_SHOWN_KEY, new Response('shown', { status: 200 }));
            return caches.match(SPLASH_PAGE);
          }

          // Skip splash for /home (your safe redirect target)
          if (pathname === '/home') {
          
            const resp = await fetch(event.request);
            return resp;
          }

          // All other paths → serve real network response + cache it
         
          const networkResp = await fetch(event.request);
          
          if (networkResp && networkResp.status === 200) {
            const clone = networkResp.clone();
            cache.put(event.request, clone);
          }

          return networkResp;
        }
      } catch (err) {
        // Offline – always serve offline.html
      
        const offlineResp = await caches.match(OFFLINE_PAGE);
        return offlineResp || new Response('Offline – no fallback cached', { status: 503 });
      }

      // Ultimate fallback (should rarely hit)
      return fetch(event.request);
    })()
  );
});