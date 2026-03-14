'use client'

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export function hapticLight() {
  if (!Capacitor.isNativePlatform()) return
  Haptics.impact({ style: ImpactStyle.Light })
}

export function hapticMedium() {
  if (!Capacitor.isNativePlatform()) return
  Haptics.impact({ style: ImpactStyle.Medium })
}

export function hapticHeavy() {
  if (!Capacitor.isNativePlatform()) return
  Haptics.impact({ style: ImpactStyle.Heavy })
}
