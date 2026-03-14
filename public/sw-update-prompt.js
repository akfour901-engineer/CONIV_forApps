// public/sw-update-prompt.js – Detect new SW and notify client to refresh

let refreshing = false;

self.addEventListener('controllerchange', () => {
  if (refreshing) return;
  refreshing = true;
  
  window.location.reload();
});

// Optional: listen for skipWaiting message from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
   
  }
});

