'use client'

import { useEffect } from 'react'

export default function PullToRefresh() {
  useEffect(() => {
    let startY = 0

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }

    const onTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].clientY

      if (window.scrollY === 0 && endY - startY > 120) {
        window.location.reload()
      }
    }

    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return null
}
