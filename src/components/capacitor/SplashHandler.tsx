"use client"

import { useEffect } from "react"
import { Capacitor } from '@capacitor/core'
export default function SplashHandler() {
  useEffect(() => {
    const hideSplash = async () => {
      if (!Capacitor.isNativePlatform()) return

      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    }

    hideSplash()
  }, [])

  return null
}
