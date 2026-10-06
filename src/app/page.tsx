import { Suspense } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { timeGreeting } from '@/lib/utils'
import { formatIstWeekdayLong } from '@/lib/ist'
import { getApprovedOnLeaveToday } from '@/lib/leave-today'
import { getFounderAttention } from '@/lib/founder-attention'
import { shortDisplayName } from '@/lib/employee-order'
import FounderHome from './FounderHome'
import WeeklyScoreBanner from '@/components/WeeklyScoreBanner'
import { getWeeklyScoreHomePrompt } from '@/lib/weekly-score-reminder'
import type { AttentionGroupKey } from '@/lib/founder-attention'

const GROUP_KEYS: AttentionGroupKey[] = ['waiting', 'overdue', 'stuck', 'at_risk', 'due_soon']

export const dynamic = 'force-dynamic'

function NeedsYouFallback() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card h-24 bg-gray-100/80" />
        ))}
      </div>
      <div className="card h-56 bg-gray-100/60" />
    </div>
  )
}

/** One row per leave entry (matches Dev Today's Attendance); short display names. */
function mapOutToday(
  people: Awaited<ReturnType<typeof getApprovedOnLeaveToday>>
): Awaited<ReturnType<typeof getApprovedOnLeaveToday>> {
  return people.map(p => ({
    ...p,
    name: shortDisplayName(p.name),
  }))
}

async function NeedsYouBody({
  viewerId,
  viewerRole,
  initialOpen,
}: {
  viewerId: string | null
  viewerRole: string | null
  initialOpen: AttentionGroupKey | null
}) {
  let attention: Awaited<ReturnType<typeof getFounderAttention>>
  let onLeave: Awaited<ReturnType<typeof getApprovedOnLeaveToday>>
  try {
    ;[attention, onLeave] = await Promise.all([
      getFounderAttention({ viewerId, viewerRole }),
      getApprovedOnLeaveToday().catch(() => []),
    ])
  } catch (err) {
    console.error('[needs-you] failed to load attention items', err)
    return (
      <div className="card px-5 py-6 text-sm text-gray-600">
        Couldn&apos;t load what needs you right now. Refresh the page to try again.
      </div>
    )
  }
  return (
    <FounderHome groups={attention.groups} outToday={mapOutToday(onLeave)} initialOpen={initialOpen} />
  )
}

/**
 * Lead home (Founder + Manager). Middleware sends every other role to /me.
 * Shows only exceptions — the old KPI dashboard now lives at /overview.
 */
export default async function NeedsYouPage({
  searchParams,
}: {
  searchParams?: { open?: string | string[]; previewScoreBanner?: string | string[] }
}) {
  const rawOpen = Array.isArray(searchParams?.open) ? searchParams?.open[0] : searchParams?.open
  const initialOpen = GROUP_KEYS.find(k => k === rawOpen) ?? null
  const session = await auth()
  const firstName = shortDisplayName(session?.user?.name ?? '')
  const role = session?.user?.role ?? null
  const userId = session?.user?.id ?? null

  // Non-Founder branch: Manager (and any future lead who lands on `/`) may see the
  // weekly self-score banner when their role is in SELF_SCORE_ROLES. Founder never does.
  const rawPreview = Array.isArray(searchParams?.previewScoreBanner)
    ? searchParams?.previewScoreBanner[0]
    : searchParams?.previewScoreBanner
  const forcePreview =
    process.env.NODE_ENV !== 'production' && rawPreview === '1'
  const scorePrompt =
    userId && role && role !== 'Founder'
      ? await getWeeklyScoreHomePrompt(userId, role, new Date(), { forcePreview })
      : { kind: 'none' as const }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight">
            {firstName ? `${timeGreeting()}, ${firstName}.` : timeGreeting()}
          </h1>
          <p className="text-sm text-gray-500 mt-1 sm:mt-0.5 leading-snug">
            Needs you — only what is waiting on your decision. Everything on track is left out.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          <Link href="/overview" className="text-xs text-gray-500 hover:text-gray-900">
            Business →
          </Link>
          <p className="text-xs text-gray-400 tabular-nums">{formatIstWeekdayLong(new Date())}</p>
        </div>
      </div>

      {scorePrompt.kind === 'due' && userId && (
        <WeeklyScoreBanner
          userId={userId}
          weekKey={scorePrompt.weekKey}
          isFriday={scorePrompt.isFriday}
        />
      )}

      <Suspense fallback={<NeedsYouFallback />}>
        <NeedsYouBody
          viewerId={userId}
          viewerRole={role}
          initialOpen={initialOpen}
        />
      </Suspense>
    </div>
  )
}
