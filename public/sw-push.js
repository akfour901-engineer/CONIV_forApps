// public/sw-push.js – Local + alert notifications (with action buttons)

self.addEventListener('push', event => {
 

  const payload = event.data?.json() || {
    title: 'CONIV Notification',
    body: 'Something new is ready!'
  };

  const options = {
    body: payload.body,
    icon: payload.icon || '/icon-192x192.png',
    badge: '/icon-maskable.png',
    vibrate: payload.vibrate || [200, 100, 200],
    tag: 'coniv-server',
    renotify: true,
    data: { url: payload.url || '/dashboard' }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'CONIV', options)
  );
});

// Handle client-sent alert notifications (with priority & buttons)
self.addEventListener('message', event => {
  if (event.data?.type === 'SHOW_ALERT_NOTIFICATION') {
    const p = event.data.payload;

    const options = {
      body: p.body,
      icon: p.icon || '/icon-192x192.png',
      badge: '/icon-maskable.png',
      vibrate: p.vibrate || [200, 100, 200, 100, 200],
      tag: `alert-${p.alertId || Date.now()}`,
      renotify: true,
      requireInteraction: p.priority === 'high',

      // Action buttons on the notification
      actions: [
        {
          action: 'view',
          title: 'View Alert',
          icon: '/icon-192x192.png' // small icon next to button
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],

      data: {
        url: '/dashboard/alerts' // can be `/dashboard/alerts?id=${p.alertId}` if per-alert pages exist
      }
    };

    event.waitUntil(
      self.registration.showNotification(p.title || 'CONIV Alert', options)
    );

    
  }
});

// Handle notification clicks (buttons or tap)
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Handle button actions
  if (event.action === 'view') {
    const url = event.notification.data?.url || '/dashboard/alerts';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
        for (const client of clientsArr) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  }

  // Default click (outside buttons) → same as 'view'
  if (!event.action) {
    const url = event.notification.data?.url || '/dashboard/alerts';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
        for (const client of clientsArr) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  }
});
