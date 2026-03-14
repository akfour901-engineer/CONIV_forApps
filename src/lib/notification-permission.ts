import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Toast } from '@capacitor/toast'

export async function requestNotificationPermission() {
  /* =========================
     📱 Native (Android/iOS)
  ========================= */
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.requestPermissions()

    if (result.display === 'granted') {
      await Toast.show({ text: 'Notifications enabled ✅' })
      return 'granted'
    }

    await Toast.show({ text: 'Notifications blocked ❌' })
    return 'denied'
  }

  /* =========================
     🌐 Web (Browser/PWA)
  ========================= */
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    return permission
  }

  return 'denied'
}
