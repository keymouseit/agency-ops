import Link from 'next/link'

type Props = {
  title: string
  icon?: string
  actionHref?: string
  actionLabel?: string
  badge?: string
  headerActions?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Tighter padding for dense panels */
  dense?: boolean
}

export default function MeSection({
  title,
  icon,
  actionHref,
  actionLabel,
  badge,
  headerActions,
  children,
  className = '',
  dense = false,
}: Props) {
  return (
    <section className={`me-enter me-surface overflow-hidden mb-5 ${className}`}>
      <div
        className={`flex items-center justify-between gap-3 border-b border-gray-100/90 bg-[#fafbfc] ${
          dense ? 'px-4 py-3' : 'px-5 py-3.5'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="text-sm leading-none opacity-70 shrink-0" aria-hidden>
              {icon}
            </span>
          )}
          <h2 className="me-section-title truncate">{title}</h2>
          {badge && (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 shrink-0">
              {badge}
            </span>
          )}
        </div>
        {headerActions}
        {!headerActions && actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="me-btn-premium text-xs font-medium text-gray-500 hover:text-gray-900 shrink-0"
          >
            {actionLabel}
          </Link>
        )}
      </div>
      <div className={dense ? 'p-4' : 'p-5'}>{children}</div>
    </section>
  )
}
