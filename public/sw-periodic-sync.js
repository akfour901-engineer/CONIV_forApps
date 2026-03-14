// public/sw-periodic-sync.js – Periodic background sync (auto data refresh)

self.addEventListener('periodicsync', event => {
    if (event.tag === 'coniv-data-sync') {
     
      event.waitUntil(
        (async () => {
          try {
            // You can replace this with your real sync endpoint
            const response = await fetch('/api/sync-data', {
              method: 'GET',
              cache: 'no-store',
              credentials: 'include'
            });
  
            if (response.ok) {
            
              // Optional: show silent local notification
              await self.registration.showNotification('CONIV', {
                body: 'Your data has been refreshed in the background.',
                icon: '/icon-192x192.png',
                silent: true
              });
            }
          } catch (err) {
            
          }
        })()
      );
    }
  });
