// app/components/ServiceWorkerRegister.tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Wait for the page to be fully loaded (good practice)
      window.addEventListener('load', () => {
        const swUrl = '/sw.js' // must be in /public/sw.js

        navigator.serviceWorker
          .register(swUrl, { scope: '/' })
          .then(registration => {
            console.log(
              'Service Worker registered successfully. Scope:',
              registration.scope
            )

            // Optional: handle updates (new version ready)
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed') {
                    console.log('New Service Worker installed — ready to activate')
                    // Optional: prompt user to refresh or auto-activate
                  }
                })
              }
            })
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error)
          })
      })
    } else {
      console.warn('Service Workers are not supported in this browser.')
    }
  }, []) // run only once on mount

  // This component doesn't render anything
  return null
}