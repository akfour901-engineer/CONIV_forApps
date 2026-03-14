'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { App } from '@capacitor/app'

export const appActiveRef = { current: true }
export const badgeCountRef = { current: 0 }

export default function LocalNotificationHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const setup = async () => {
      await LocalNotifications.requestPermissions()

      /* Track foreground/background */
      App.addListener('appStateChange', ({ isActive }) => {
        appActiveRef.current = isActive
      })

      /* Deep link on tap */
      LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (event) => {
          const id = event.notification.extra?.alertId
          if (id) {
            window.location.href = `/dashboard/alerts/${id}`
          }
        }
      )
    }

    setup()
  }, [])

  return null
}
