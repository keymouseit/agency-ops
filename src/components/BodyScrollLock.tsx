'use client'

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

/** Mount while a modal/drawer/popup is open to freeze background scroll (PWA/iOS safe). */
export default function BodyScrollLock({ active = true }: { active?: boolean }) {
  useBodyScrollLock(active)
  return null
}
