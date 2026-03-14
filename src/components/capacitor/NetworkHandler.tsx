'use client'

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'
import { Toast } from '@capacitor/toast'

export default function NetworkHandler() {
  const isOfflineRef = useRef<boolean | null>(null) // track current status to prevent loops

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let listener: any

    const goOffline = async () => {
      if (isOfflineRef.current === true) return // already offline, do nothing
      isOfflineRef.current = true

      await Toast.show({ text: 'No internet connection' })

      // redirect only if not already on offline page
      if (!window.location.pathname.includes('offline.html')) {
        window.location.replace('/offline.html')
      }
    }

    const goOnline = async () => {
      if (isOfflineRef.current === false) return // already online, do nothing
      isOfflineRef.current = false

      await Toast.show({ text: 'Back online' })

      // reload only if currently on offline page
      if (window.location.pathname.includes('offline.html')) {
        window.location.replace('/') // go back to home
      }
    }

    const init = async () => {
      const status = await Network.getStatus()
      if (!status.connected) {
        goOffline()
      } else {
        isOfflineRef.current = false
      }

      listener = Network.addListener('networkStatusChange', (status) => {
        if (!status.connected) goOffline()
        else goOnline()
      })
    }

    init()

    return () => listener?.remove()
  }, [])

  return null
}