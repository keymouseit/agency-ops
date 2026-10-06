'use client'

import { useRouter } from 'next/navigation'
import { useTransition, type ReactNode } from 'react'
import { useNavigationPending } from './NavigationProvider'

/**
 * Table row that navigates on click (keep a real <Link> inside for keyboard / new-tab use).
 * Prefetches on hover; while the route loads the row gets `aria-busy` and
 * `data-pending="true"` (style it with e.g. `group` + `group-data-[pending=true]:…`),
 * and the global top progress bar shows when the pathname changes.
 */
export default function ClickableRow({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const { startNavigation } = useNavigationPending()
  const [isPending, startTransition] = useTransition()
  return (
    <tr
      className={`cursor-pointer ${isPending ? 'opacity-70' : ''} ${className ?? ''}`}
      aria-busy={isPending || undefined}
      data-pending={isPending ? 'true' : undefined}
      onMouseEnter={() => router.prefetch(href)}
      onClick={e => {
        // Let inner links / buttons handle their own clicks.
        if ((e.target as HTMLElement).closest('a,button')) return
        if (e.metaKey || e.ctrlKey) {
          window.open(href, '_blank', 'noopener')
          return
        }
        // The top bar clears on pathname change, so only start it when the pathname changes.
        if (new URL(href, window.location.href).pathname !== window.location.pathname) startNavigation()
        startTransition(() => router.push(href))
      }}
    >
      {children}
    </tr>
  )
}
