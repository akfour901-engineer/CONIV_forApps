import { Capacitor } from '@capacitor/core'
import { Toast } from '@capacitor/toast'

export async function nativeToast(message: string) {
  if (!Capacitor.isNativePlatform()) return
  await Toast.show({ text: message })
}
