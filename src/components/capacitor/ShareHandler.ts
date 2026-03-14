import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

export async function shareText(text: string) {
  if (!Capacitor.isNativePlatform()) return

  await Share.share({
    text,
  })
}
