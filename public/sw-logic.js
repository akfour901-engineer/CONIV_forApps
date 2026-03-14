// public/sw.js – Secure minimal orchestrator
// This is the ONLY file users will see

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');
workbox.setConfig({ debug: false });

// Safe loader: continue even if one module fails
function loadModule(url) {
  try {
    importScripts(url);
  } catch (e) {
    // Silent fail – don't break the whole SW
  }
}

// Load all your modules (order: critical first)
loadModule('/sw-splash-offline.js');     // splash + offline fallback
loadModule('/sw-fallback-error.js');     // error/404 fallback
loadModule('/sw-precache.js');           // precaching
loadModule('/sw-static.js');             // CSS/JS/fonts
loadModule('/sw-images.js');             // images
loadModule('/sw-api.js');                // API + background sync
loadModule('/sw-push.js');               // push notifications
loadModule('/sw-periodic-sync.js');      // periodic sync
loadModule('/sw-update-prompt.js');      // update notification
loadModule('/sw-share.js');              // share target handling

// Global cleanup – only remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => !key.startsWith('coniv-')).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});