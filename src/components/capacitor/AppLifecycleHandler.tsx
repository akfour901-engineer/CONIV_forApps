'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Toast } from '@capacitor/toast'

export default function AppLifecycleHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let listener: any

    const setup = async () => {
      listener = await App.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) return

        /* 🔥 check permission */
        const perms = await LocalNotifications.checkPermissions()

        /* only ask if not granted */
        if (perms.display !== 'granted') {
          const result = await LocalNotifications.requestPermissions()

          if (result.display === 'granted') {
            await Toast.show({ text: 'Notifications enabled ✅' })
          }
        }
      })
    }

    setup()

    return () => {
      listener?.remove()
    }
  }, [])

  return null
}
