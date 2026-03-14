'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'

export default function KeyboardHandler() {
  useEffect(() => {
    const setup = async () => {
      if (!Capacitor.isNativePlatform()) return

      Keyboard.setResizeMode({
        mode: KeyboardResize.Body   // ✅ enum, NOT string
      })

      Keyboard.setAccessoryBarVisible({
        isVisible: false
      })
    }

    setup()
  }, [])

  return null
}
