// app/components/ServiceWorkerRegister.tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    

    if (!('serviceWorker' in navigator)) {
     
      return
    }

   

    const registerSW = async () => {
      try {
       

        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) {
          await reg.unregister()
         
        }

        

        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })

      /*  console.log('[SW Register] SUCCESS! Scope:', registration.scope)
        console.log('[SW Register] State:', {
          installing: !!registration.installing,
          waiting: !!registration.waiting,
          active: !!registration.active
        })*/

        // Handle updates
        registration.addEventListener('updatefound', () => {
          //console.log('[SW Register] Update found')
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              //  console.log('[SW Register] New SW installed – auto-activating')
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          }
        })

        // Periodic sync
        if ('periodicSync' in registration) {
          try {
            const regAny = registration as any
            await regAny.periodicSync.register('coniv-data-sync', {
              minInterval: 24 * 60 * 60 * 1000
            })
           // console.log('[SW Register] Periodic sync registered')
          } catch (err) {
           // console.warn('[SW Register] Periodic sync failed:', err)
          }
        } else {
          //console.log('[SW Register] Periodic sync not supported')
        }

        // Notifications
        if ('Notification' in window) {
          const permission = await Notification.requestPermission()
         // console.log('[SW Register] Notification permission:', permission)

          if (permission === 'granted' && registration.active) {
            //console.log('[SW Register] Showing test notification')
            registration.showNotification('CONIV Ready', {
              body: 'App is ready to work offline!',
              icon: '/icon-192x192.png',
              badge: '/icon-maskable.png',
              vibrate: [200, 100, 200]
            } as NotificationOptions)
          }
        }
      } catch (error) {
       // console.error('[SW Register] Setup failed:', error)
      }
    }

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW, { once: true })
    }
  }, [])

  return null
}