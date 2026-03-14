import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Toast } from '@capacitor/toast'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { appActiveRef } from '@/components/capacitor/LocalNotificationHandler'

export async function showAlertNotification(alert: {
  title: string
  message: string
  alertId?: string | number
  priority?: 'normal' | 'high'
}) {
  const title = alert.title || 'CONIV Alert'
  const body = alert.message
  const id = Number(String(alert.alertId || Date.now()).slice(-6))

  /* =====================================
     📱 NATIVE
  ===================================== */
  if (Capacitor.isNativePlatform()) {

    // 🔥 haptic for important alerts
    if (alert.priority === 'high') {
      await Haptics.impact({ style: ImpactStyle.Medium })
    }

    // 👉 APP OPEN → toast only
    if (appActiveRef.current) {
      await Toast.show({
        text: `${title} • ${body}`,
        duration: 'short',
      })
      return
    }

    // 👉 APP CLOSED → system notification
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'default',
          extra: { alertId: alert.alertId }, // ⭐ deep link support
        },
      ],
    })

    return
  }

  /* =====================================
     🌐 WEB (PWA)
  ===================================== */
  if (Notification.permission !== 'granted') return
  if (!navigator.serviceWorker?.controller) return

  navigator.serviceWorker.controller.postMessage({
    type: 'SHOW_ALERT_NOTIFICATION',
    payload: {
      title,
      body,
      icon: '/icon-192x192.png',
    },
  })
}
