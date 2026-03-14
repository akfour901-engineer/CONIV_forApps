'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

export default function BackButtonHandler() {
  useEffect(() => {
    const setupBack = async () => {
      if (!Capacitor.isNativePlatform()) return

      const { App } = await import('@capacitor/app')

      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          App.exitApp()
        }
      })
    }

    setupBack()
  }, [])

  return null
}
