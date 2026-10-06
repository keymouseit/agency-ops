import Link from 'next/link'

export type AttentionItem = {
  id: string
  kind: 'action' | 'follow_up'
  title: string
  clientLabel: string
  ownerName: string
  daysOverdue: number
  href: string
}

export type BlockedAttentionItem = {
  id: string
  title: string
  clientLabel: string
  ownerName: string
  reason: string
  href: string
}

export type AttentionStats = {
  overdueFollowUps: number
  overdueActions: number
  dueToday: number
  dueNext7Days: number
  openActions: number
  blockedActions: number
  topOverdue: AttentionItem[]
  topBlocked: BlockedAttentionItem[]
}

export function MetricCard({
  label,
  count,
  tone,
  href,
}: {
  label: string
  count: number
  tone: 'neutral' | 'red' | 'amber' | 'blue'
  href?: string
}) {
  const toneCls =
    tone === 'red'
      ? 'border-red-200 bg-red-50/50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/50'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50/40'
          : 'border-gray-200 bg-white'
  const countCls =
    tone === 'red'
      ? 'text-red-700'
      : tone === 'amber'
        ? 'text-amber-800'
        : tone === 'blue'
          ? 'text-blue-700'
          : 'text-gray-900'

  const inner = (
    <>
      <div className={`text-xl font-bold tabular-nums ${countCls}`}>{count}</div>
      <div className="text-xs text-gray-500 mt-0.5 leading-snug">{label}</div>
      {href && count > 0 && (
        <div className="text-[10px] text-gray-400 mt-1.5 group-hover:text-gray-600">View list →</div>
      )}
    </>
  )

  if (href && count > 0) {
    return (
      <Link
        href={href}
        className={`group card p-3 border block hover:shadow-sm transition-shadow ${toneCls}`}
      >
        {inner}
      </Link>
    )
  }

  return <div className={`card p-3 border ${toneCls}`}>{inner}</div>
}

function truncateBlockedReason(reason: string, max = 90) {
  const r = reason.trim()
  if (!r) return 'No reason given'
  if (r.length <= max) return r
  return `${r.slice(0, max - 1)}…`
}

/** Slim Founder/Manager attention board — high-signal only, no analytics clutter. */
export default function MomAnalytics({ stats }: { stats: AttentionStats }) {
  const {
    overdueFollowUps,
    overdueActions,
    dueToday,
    dueNext7Days,
    openActions,
    blockedActions,
    topOverdue,
    topBlocked,
  } = stats

  return (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Needs attention</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Overdue, blocked, and soon-due follow-ups and actions — what needs full focus.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2 mb-2">
        <MetricCard
          label="Overdue follow-ups"
          count={overdueFollowUps}
          tone={overdueFollowUps > 0 ? 'red' : 'neutral'}
          href="/mom?filter=overdue"
        />
        <MetricCard
          label="Overdue actions"
          count={overdueActions}
          tone={overdueActions > 0 ? 'red' : 'neutral'}
          href="/mom?filter=overdue"
        />
        <MetricCard
          label="Blocked actions"
          count={blockedActions}
          tone={blockedActions > 0 ? 'red' : 'neutral'}
          href="/mom?filter=blocked"
        />
        <MetricCard
          label="Due today"
          count={dueToday}
          tone={dueToday > 0 ? 'amber' : 'neutral'}
          href="/mom?filter=due_soon"
        />
        <MetricCard
          label="Due in next 7 days"
          count={dueNext7Days}
          tone={dueNext7Days > 0 ? 'blue' : 'neutral'}
          href="/mom?filter=due_soon"
        />
        <MetricCard
          label="Open actions"
          count={openActions}
          tone="neutral"
        />
      </div>

      {(topOverdue.length > 0 || topBlocked.length > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50/40 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-red-100 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-red-800">
              Needs review
            </h3>
            <div className="flex items-center gap-3 shrink-0">
              {topOverdue.length > 0 && (
                <Link
                  href="/mom?filter=overdue"
                  className="text-[11px] font-medium text-red-700 hover:underline"
                >
                  See all overdue
                </Link>
              )}
              {topBlocked.length > 0 && (
                <Link
                  href="/mom?filter=blocked"
                  className="text-[11px] font-medium text-red-800 hover:underline"
                >
                  See all blocked
                </Link>
              )}
            </div>
          </div>
          <ul className="divide-y divide-red-100/80">
            {topOverdue.slice(0, 3).map(item => (
              <li key={`od-${item.kind}-${item.id}`}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50/80 min-w-0"
                >
                  <span className="badge border bg-red-50 text-red-700 border-red-200 shrink-0 text-[10px]">
                    {item.daysOverdue}d overdue
                  </span>
                  <span className="text-xs text-gray-900 truncate min-w-0">
                    {item.title}
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="text-gray-500">{item.ownerName}</span>
                  </span>
                </Link>
              </li>
            ))}
            {topBlocked.slice(0, 3).map(item => (
              <li key={`bk-${item.id}`}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-100/50 min-w-0"
                >
                  <span className="badge border bg-red-600 text-white border-red-700 shrink-0 text-[10px]">
                    Blocked
                  </span>
                  <span className="text-xs text-red-950 truncate min-w-0">
                    {item.title}
                    <span className="text-red-300 mx-1">·</span>
                    <span className="text-red-800/80">{item.ownerName}</span>
                    <span className="text-red-300 mx-1">·</span>
                    <span className="text-red-800/70">{truncateBlockedReason(item.reason, 60)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topOverdue.length === 0 &&
        topBlocked.length === 0 &&
        overdueFollowUps === 0 &&
        overdueActions === 0 &&
        blockedActions === 0 &&
        dueToday === 0 && (
          <div className="rounded-lg border border-green-100 bg-green-50/50 px-3 py-2 text-xs text-green-800">
            Nothing overdue, blocked, or due today — pipeline looks clear.
          </div>
        )}
    </div>
  )
}

export type BdAttentionStats = {
  overdueFollowUps: number
  overdueActions: number
  dueNext7Days: number
  myOpenActions: number
  myBlockedActions?: number
}

/** Slim BD attention strip — overdue / due-soon / my actions only. */
export function BdAttentionStrip({ stats }: { stats: BdAttentionStats }) {
  const { overdueFollowUps, overdueActions, dueNext7Days, myOpenActions, myBlockedActions = 0 } = stats

  return (
    <div className="mb-6">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Needs attention</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Overdue and soon-due items, plus your open actions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Overdue follow-ups"
          count={overdueFollowUps}
          tone={overdueFollowUps > 0 ? 'red' : 'neutral'}
          href="/mom?filter=overdue"
        />
        <MetricCard
          label="Overdue actions"
          count={overdueActions}
          tone={overdueActions > 0 ? 'red' : 'neutral'}
          href="/mom?filter=overdue"
        />
        <MetricCard
          label="Due in next 7 days"
          count={dueNext7Days}
          tone={dueNext7Days > 0 ? 'blue' : 'neutral'}
          href="/mom?filter=due_soon"
        />
        <MetricCard
          label="My open actions"
          count={myOpenActions}
          tone={myOpenActions > 0 ? 'amber' : 'neutral'}
          href="/mom?filter=my_actions"
        />
      </div>

      {myBlockedActions > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-800">
          <span className="font-semibold">You have {myBlockedActions} blocked action{myBlockedActions === 1 ? '' : 's'}</span>
          {' — '}
          <Link href="/mom?filter=blocked" className="underline font-medium hover:text-red-950">
            review blocked
          </Link>
          {' '}so the founder can unblock next steps.
        </div>
      )}
    </div>
  )
}
