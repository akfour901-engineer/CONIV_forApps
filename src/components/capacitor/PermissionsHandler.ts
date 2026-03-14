import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export async function requestPermissions() {
  if (!Capacitor.isNativePlatform()) return

  await LocalNotifications.requestPermissions()
}
