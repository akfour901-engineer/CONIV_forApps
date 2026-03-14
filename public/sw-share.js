// public/sw-share.js – Handle shared files/text from system share sheet

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
  
    if (url.pathname === '/share' && event.request.method === 'POST') {
      event.respondWith(
        (async () => {
          try {
            const formData = await event.request.formData();
  
            const title = formData.get('title');
            const text = formData.get('text');
            const urlShared = formData.get('url');
            const files = formData.getAll('files'); // array of File objects
  
            
  
            // Option 1: Open dashboard and pass data via URL params (simple)
            let redirectUrl = '/dashboard?share=true';
            if (title) redirectUrl += `&title=${encodeURIComponent(title)}`;
            if (text) redirectUrl += `&text=${encodeURIComponent(text)}`;
            if (urlShared) redirectUrl += `&url=${encodeURIComponent(urlShared)}`;
  
            // If files were shared – you can handle them later in client code
            // For now we just open the app
  
            return Response.redirect(redirectUrl, 303);
          } catch (err) {
            
            return new Response('Share failed', { status: 500 });
          }
        })()
      );
    }
  });
  
 