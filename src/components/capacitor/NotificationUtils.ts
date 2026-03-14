import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export async function notifyNow(title: string, body: string) {
  if (!Capacitor.isNativePlatform()) return

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now(),
        title,
        body,
        schedule: { at: new Date(Date.now() + 100) },
      },
    ],
  })
}

export async function notifyAfterSeconds(
  title: string,
  body: string,
  seconds: number
) {
  if (!Capacitor.isNativePlatform()) return

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now(),
        title,
        body,
        schedule: {
          at: new Date(Date.now() + seconds * 1000),
        },
      },
    ],
  })
}

export async function dailyReminder(hour: number, minute: number) {
  if (!Capacitor.isNativePlatform()) return

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 999,
        title: 'Study Time 📚',
        body: 'Time for UPSC preparation!',
        schedule: {
          on: { hour, minute },
          repeats: true,
        },
      },
    ],
  })
}
