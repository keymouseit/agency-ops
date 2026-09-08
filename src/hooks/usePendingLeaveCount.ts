'use client'

import { useCallback, useEffect, useState } from 'react'

export const LEAVES_PENDING_EVENT = 'leaves-pending-changed'

export function notifyLeavesPendingChanged(count?: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LEAVES_PENDING_EVENT, { detail: { count } }))
}

export function usePendingLeaveCount(enabled: boolean) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch('/api/leaves/pending-count', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.count === 'number') setCount(data.count)
    } catch {
      // keep last known count
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }

    void refresh()

    function onEvent(e: Event) {
      const detail = (e as CustomEvent<{ count?: number }>).detail
      if (detail && typeof detail.count === 'number') {
        setCount(detail.count)
        return
      }
      void refresh()
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void refresh()
    }

    window.addEventListener(LEAVES_PENDING_EVENT, onEvent)
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 30000)

    return () => {
      window.removeEventListener(LEAVES_PENDING_EVENT, onEvent)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [enabled, refresh])

  return count
}
