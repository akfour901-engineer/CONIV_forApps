'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export default function StatusBarHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const setup = async () => {
      try {
        // show status bar
        await StatusBar.show()

        // DO NOT overlay app (prevents UI cut)
        await StatusBar.setOverlaysWebView({ overlay: false })

        // icon color
        await StatusBar.setStyle({
          style: Style.Light // use Style.Dark if bg is dark
        })

        // background color (Android only)
        await StatusBar.setBackgroundColor({
          color: '#008080' // match your app bg
        })
      } catch (e) {
        console.log('StatusBar error:', e)
      }
    }

    setup()
  }, [])

  return null
}
