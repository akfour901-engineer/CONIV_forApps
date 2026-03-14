'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'

export default function OrientationHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let listener: any

    const setup = async () => {
      listener = await ScreenOrientation.addListener(
        'screenOrientationChange',
        () => {}
      )

      await ScreenOrientation.lock({ orientation: 'portrait' })
    }

    setup()

    return () => {
      listener?.remove()
    }
  }, [])

  return null
}
