'use client'

import { useEffect } from 'react'

/**
 * iOS Safari / PWA: `overflow: hidden` alone still lets the page behind a
 * modal scroll. Lock body with position:fixed + restore scroll on unlock.
 * Ref-counted so stacked modals / drawer + dialog both work.
 */
let lockCount = 0
let lockedScrollY = 0
let prevOverflow = ''
let prevPosition = ''
let prevTop = ''
let prevWidth = ''
let prevTouchAction = ''

function applyBodyLock() {
  if (typeof document === 'undefined') return
  const { style } = document.body
  lockedScrollY = window.scrollY
  prevOverflow = style.overflow
  prevPosition = style.position
  prevTop = style.top
  prevWidth = style.width
  prevTouchAction = style.touchAction
  style.overflow = 'hidden'
  style.position = 'fixed'
  style.top = `-${lockedScrollY}px`
  style.width = '100%'
  style.touchAction = 'none'
}

function releaseBodyLock() {
  if (typeof document === 'undefined') return
  const { style } = document.body
  style.overflow = prevOverflow
  style.position = prevPosition
  style.top = prevTop
  style.width = prevWidth
  style.touchAction = prevTouchAction
  window.scrollTo(0, lockedScrollY)
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    if (lockCount === 0) applyBodyLock()
    lockCount += 1
    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) releaseBodyLock()
    }
  }, [locked])
}
