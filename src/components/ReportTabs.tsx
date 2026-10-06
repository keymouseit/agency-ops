import Link from 'next/link'
import type { ReactNode } from 'react'

export type ReportTabItem = { key: string; label: string; href: string; icon?: ReactNode }

/**
 * Link-driven tabs for server-rendered report pages (`?tab=` in the URL, so
 * every tab is linkable). `variant="pills"` is the segmented sub-tab control
 * (full-width on phones, inline from `sm`).
 */
export default function ReportTabs({
  tabs,
  active,
  variant = 'underline',
  className,
}: {
  tabs: ReportTabItem[]
  active: string
  variant?: 'underline' | 'pills'
  className?: string
}) {
  if (variant === 'pills') {
    return (
      <div
        className={`flex w-full sm:inline-flex sm:w-auto items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 ${className ?? 'mb-5'}`}
        role="tablist"
      >
        {tabs.map(t => {
          const on = active === t.key
          return (
            <Link
              key={t.key}
              href={t.href}
              role="tab"
              aria-selected={on}
              aria-current={on ? 'page' : undefined}
              scroll={false}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/70 ${
                on
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-500 hover:bg-white/60 hover:text-gray-800'
              }`}
            >
              {t.icon ? <span className={on ? 'text-gray-700' : 'text-gray-400'}>{t.icon}</span> : null}
              {t.label}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`flex gap-5 border-b border-gray-200 overflow-x-auto ${className ?? 'mb-6'}`} role="tablist">
      {tabs.map(t => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          scroll={false}
          className={`pb-3 -mb-px text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            active === t.key
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
