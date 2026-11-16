'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'ao-pwa-install-dismissed'

function isIos() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOS || iPadOs
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

export default function PwaRegister() {
  const [showIosTip, setShowIosTip] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      } catch {
        // Ignore SW failures in unsupported / blocked contexts.
      }
    }

    void register()
  }, [])

  useEffect(() => {
    try {
      if (isStandalone()) return
      if (!isIos()) return
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return
      setShowIosTip(true)
    } catch {
      // localStorage may be blocked
    }
  }, [])

  if (!showIosTip) return null

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[60] mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-3 shadow-lg sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Install Agency Ops</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            On iPhone/iPad: tap <span className="font-medium text-gray-800">Share</span>, then{' '}
            <span className="font-medium text-gray-800">Add to Home Screen</span>.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS_KEY, '1')
            } catch {
              // ignore
            }
            setShowIosTip(false)
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
