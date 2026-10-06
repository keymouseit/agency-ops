import type { ReactNode } from 'react'
import { KpiIcon, type KpiIconName } from './KpiCard'

/** Friendly empty state: icon tile, short title, grey hint and an optional action. */
export default function EmptyState({
  icon = 'inbox',
  title,
  hint,
  action,
  compact = false,
  className = '',
}: {
  icon?: KpiIconName
  title: string
  hint?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-5' : 'px-6 py-10'} ${className}`}>
      <span
        className={`inline-flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 ring-1 ring-inset ring-gray-100 ${
          compact ? 'h-9 w-9' : 'h-11 w-11'
        }`}
      >
        <KpiIcon name={icon} className={compact ? 'h-[18px] w-[18px]' : 'h-5 w-5'} />
      </span>
      <p className={`${compact ? 'mt-2 text-xs' : 'mt-3 text-sm'} font-medium text-gray-700`}>{title}</p>
      {hint ? <div className={`mt-1 max-w-sm text-gray-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>{hint}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
