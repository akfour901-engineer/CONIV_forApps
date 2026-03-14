// sw-badge.js – Update app icon badge for unread alerts

self.addEventListener('message', event => {
    if (event.data?.type === 'UPDATE_BADGE') {
      const unreadCount = event.data.count || 0;
      
    }
  });
  
  