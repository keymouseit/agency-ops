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
}: Props) {
  return (
    <section className={`card overflow-hidden mb-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm shrink-0">
              {icon}
            </span>
          )}
          <h2 className="text-sm font-semibold text-gray-900 truncate">{title}</h2>
          {badge && (
            <span className="badge bg-gray-200 text-gray-700 text-[11px] shrink-0">{badge}</span>
          )}
        </div>
        {headerActions}
        {!headerActions && actionHref && actionLabel && (
          <Link href={actionHref} className="text-xs text-gray-500 hover:text-gray-900 shrink-0">
            {actionLabel}
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
