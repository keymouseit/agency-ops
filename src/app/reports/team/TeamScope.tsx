'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import ScoreTrendTable from '@/components/ScoreTrendTable'
import Link from 'next/link'
import SubmitScoreForm from '@/app/team/SubmitScoreForm'
import { avg, getWeekStart } from '@/lib/utils'
import { formatIst } from '@/lib/ist'
import { subWeeks } from 'date-fns'

/**
 * Scopes the people overview on /reports/team to the employee picked in the
 * individual report above it. The report keeps its selection in client state
 * (URL synced via history.replaceState, so no server re-render), so the
 * selection is shared through this tiny module-level store instead.
 */
let selectedMemberId: string | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Called by the embedded EmployeeReportClient whenever its employee changes. */
export function setSelectedReportMember(id: string | null) {
  if (selectedMemberId === id) return
  selectedMemberId = id
  listeners.forEach(l => l())
}

type ScopeCtx = {
  selectedId: string | null
  showAll: boolean
  setShowAll: (v: boolean) => void
}

const TeamScopeContext = createContext<ScopeCtx>({
  selectedId: null,
  showAll: true,
  setShowAll: () => {},
})

export function TeamScopeProvider({
  initialMemberId,
  children,
}: {
  /** Server-side guess of the selected employee (URL memberId, else first employee). */
  initialMemberId: string | null
  children: ReactNode
}) {
  const live = useSyncExternalStore(
    subscribe,
    () => selectedMemberId,
    () => null,
  )
  const selectedId = live ?? initialMemberId ?? null
  const [showAll, setShowAll] = useState(false)

  // New person picked → go back to showing only them.
  useEffect(() => {
    setShowAll(false)
  }, [selectedId])

  return (
    <TeamScopeContext.Provider value={{ selectedId, showAll, setShowAll }}>
      {children}
    </TeamScopeContext.Provider>
  )
}

function useTeamScope() {
  const ctx = useContext(TeamScopeContext)
  return { ...ctx, filtering: !!ctx.selectedId && !ctx.showAll }
}

/** Renders its row only when it belongs to the selected employee (or "show all" is on). */
export function ScopedRow({ memberId, children }: { memberId: string; children: ReactNode }) {
  const { filtering, selectedId } = useTeamScope()
  if (filtering && memberId !== selectedId) return null
  return <>{children}</>
}

export function PeopleCount({ memberIds }: { memberIds: string[] }) {
  const { filtering, selectedId } = useTeamScope()
  const n = filtering ? memberIds.filter(id => id === selectedId).length : memberIds.length
  return <span className="text-gray-400 font-normal">· {n}</span>
}

export function LowActivityNote({ lowActivityIds }: { lowActivityIds: string[] }) {
  const { filtering, selectedId } = useTeamScope()
  const n = filtering ? lowActivityIds.filter(id => id === selectedId).length : lowActivityIds.length
  if (n === 0) return null
  return (
    <>
      {' · '}
      <span className="text-red-600">{n} low activity</span>
    </>
  )
}

export function ShowAllToggle({ total }: { total: number }) {
  const { selectedId, showAll, setShowAll } = useTeamScope()
  if (!selectedId || total <= 1) return null
  return (
    <button
      type="button"
      onClick={() => setShowAll(!showAll)}
      className="text-xs text-gray-500 hover:text-gray-900 shrink-0"
    >
      {showAll ? 'Selected only' : `Show all ${total}`}
    </button>
  )
}

type SubmitPerson = { id: string; name: string; role: string; expected: boolean; submitted: boolean }

/** "Scores this week" line — whole team, or just the selected employee's status. */
export function WeeklyScoreStatus({ people }: { people: SubmitPerson[] }) {
  const { filtering, selectedId } = useTeamScope()
  const expected = people.filter(p => p.expected)
  const submitted = expected.filter(p => p.submitted)
  const missing = expected.filter(p => !p.submitted)
  const person = filtering ? people.find(p => p.id === selectedId) ?? null : null

  if (person) {
    return (
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          Scores this week: {person.name}{' '}
          {person.expected ? (
            <span className={person.submitted ? 'text-gray-500 font-medium' : 'text-amber-600 font-medium'}>
              · {person.submitted ? 'submitted' : 'not submitted'}
            </span>
          ) : (
            <span className="text-gray-400 font-medium">· no weekly self-score expected ({person.role})</span>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-1 tabular-nums">
          Team: {submitted.length} of {expected.length} submitted
        </p>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-900">
        Scores this week:{' '}
        <span className="tabular-nums">
          {submitted.length} of {expected.length} submitted
        </span>
      </p>
      {missing.length > 0 ? (
        <p className="text-xs text-gray-400 mt-1 leading-snug">
          Not submitted: {missing.map(m => m.name).join(', ')}
        </p>
      ) : expected.length > 0 ? (
        <p className="text-xs text-gray-400 mt-1">Everyone expected has submitted.</p>
      ) : null}
    </div>
  )
}

type TrendScoreIn = { memberId: string; weekOf: string; delivery: number; process: number; culture: number }

/** Team score trends, or the selected employee's own weekly scores. */
export function ScopedScoreTrend({
  scores,
  names,
  weeksBack = 8,
}: {
  scores: TrendScoreIn[]
  names: Record<string, string>
  weeksBack?: number
}) {
  const { filtering, selectedId } = useTeamScope()
  const list = (filtering ? scores.filter(s => s.memberId === selectedId) : scores).map(s => ({
    ...s,
    weekOf: new Date(s.weekOf),
  }))
  const title =
    filtering && selectedId
      ? `${names[selectedId] ?? 'Selected'} — score trends, last ${weeksBack} weeks`
      : `Team score trends — last ${weeksBack} weeks`
  return <ScoreTrendTable scores={list} weeksBack={weeksBack} title={title} />
}

/** Full team layout — rendered only in "Show all" mode (or when nothing is selected). */
export function FullOnly({ children }: { children: ReactNode }) {
  const { filtering } = useTeamScope()
  if (filtering) return null
  return <>{children}</>
}

export type CompactPerson = {
  id: string
  name: string
  role: string
  expected: boolean
  submitted: boolean
  recentAvg: number | null
  scoreTrend: number | null
  logsDaily: boolean
  loggedHours: number
  utilisation: number
  billability: number | null
  doneTasks: number
  totalTasks: number
  lowActivity: boolean
  goals: { id: string; title: string; progressPct: number }[]
}

const TREND_DIMS = [
  { key: 'delivery', label: 'Delivery' },
  { key: 'process', label: 'Process' },
  { key: 'culture', label: 'Culture' },
] as const

const scoreTone = (v: number) => (v >= 8 ? 'text-gray-900' : v >= 6 ? 'text-amber-700' : 'text-red-600')

/**
 * Selected-only mode: one compact "Weekly score" card instead of the rubric,
 * submit-status card, single-row people table and the 8-week trends table.
 */
export function SelectedWeeklyCard({
  people,
  scores,
  canRate,
  formMembers,
  weeksBack = 8,
}: {
  people: CompactPerson[]
  scores: TrendScoreIn[]
  canRate: boolean
  formMembers: { id: string; name: string; role: string }[]
  weeksBack?: number
}) {
  const { filtering, selectedId, setShowAll } = useTeamScope()
  if (!filtering) return null
  const p = people.find(x => x.id === selectedId)
  if (!p) return null

  const expected = people.filter(x => x.expected)
  const submittedCount = expected.filter(x => x.submitted).length

  const weeks = Array.from({ length: weeksBack }, (_, i) =>
    getWeekStart(subWeeks(new Date(), weeksBack - 1 - i)),
  )
  const mine = scores.filter(s => s.memberId === p.id)
  const byWeek = new Map<number, TrendScoreIn[]>()
  for (const s of mine) {
    const k = getWeekStart(new Date(s.weekOf)).getTime()
    const list = byWeek.get(k)
    if (list) list.push(s)
    else byWeek.set(k, [s])
  }
  const cols = weeks.map(w => {
    const ws = byWeek.get(w.getTime()) ?? []
    return {
      key: w.getTime(),
      label: formatIst(w, { day: 'numeric', month: 'short' }),
      delivery: ws.length ? avg(ws.map(s => s.delivery)) : null,
      process: ws.length ? avg(ws.map(s => s.process)) : null,
      culture: ws.length ? avg(ws.map(s => s.culture)) : null,
    }
  })
  const hasTrend = cols.some(c => c.delivery != null)

  const hasHours = p.logsDaily || p.loggedHours > 0
  const stats: { label: string; value: string; tone?: string }[] = [
    {
      label: 'Logged 7d',
      value: hasHours ? `${p.loggedHours.toFixed(1)}h` : '—',
      tone: p.lowActivity ? 'text-red-600' : undefined,
    },
    { label: 'Billable', value: p.billability != null ? `${p.billability}%` : '—' },
    {
      label: 'Tasks',
      value: p.totalTasks > 0 ? `${p.doneTasks}/${p.totalTasks} (${Math.round((p.doneTasks / p.totalTasks) * 100)}%)` : '—',
    },
    {
      label: 'Utilisation',
      value: p.logsDaily ? `${p.utilisation}%` : '—',
      tone: p.logsDaily ? (p.utilisation >= 80 ? undefined : p.utilisation >= 60 ? 'text-amber-700' : 'text-red-600') : undefined,
    },
    {
      label: 'Goals',
      value:
        p.goals.length === 0
          ? 'none'
          : p.goals
              .slice(0, 2)
              .map(g => `${g.title} ${g.progressPct}%`)
              .join(', ') + (p.goals.length > 2 ? ` +${p.goals.length - 2}` : ''),
    },
  ]

  return (
    <section className="card px-4 py-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Weekly score</h2>
          <span className="text-xs text-gray-400 truncate">
            {p.name} · Team {submittedCount}/{expected.length} submitted this week
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Show all {people.length}
          </button>
          <Link href="/goals" className="text-xs text-gray-500 hover:text-gray-900">
            Manage goals →
          </Link>
          {canRate && (
            <SubmitScoreForm
              key={p.id}
              members={formMembers}
              founderMode
              initialMemberId={p.id}
              buttonLabel="+ Submit score"
              buttonClassName="text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 px-2.5 py-1 rounded-md"
            />
          )}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6 items-center">
        {/* Left: status + score + 7-day stats */}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {p.expected ? (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  p.submitted ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {p.submitted ? 'Submitted' : 'Not submitted'}
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                No self-score ({p.role})
              </span>
            )}
            <span className="inline-flex items-baseline gap-1">
              <span
                className={`text-lg font-bold tabular-nums leading-none ${
                  p.recentAvg != null ? scoreTone(p.recentAvg) : 'text-gray-300'
                }`}
              >
                {p.recentAvg != null ? p.recentAvg.toFixed(1) : '—'}
              </span>
              <span className="text-[11px] text-gray-400">avg 4 wk</span>
              {p.scoreTrend != null && (
                <span className={`text-[11px] tabular-nums ${p.scoreTrend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {p.scoreTrend > 0
                    ? `▲ +${p.scoreTrend.toFixed(1)}`
                    : p.scoreTrend < 0
                      ? `▼ ${p.scoreTrend.toFixed(1)}`
                      : '→'}
                </span>
              )}
            </span>
            {canRate && (
              <SubmitScoreForm
                members={formMembers}
                founderMode
                initialMemberId={p.id}
                lockMember
                buttonLabel="Rate"
                buttonClassName="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded-md border border-gray-200 hover:bg-gray-50"
              />
            )}
          </div>
          <p className="text-xs text-gray-500 leading-snug">
            {stats.map((st, i) => (
              <span key={st.label}>
                {i > 0 && <span className="text-gray-300"> · </span>}
                {st.label}{' '}
                <span className={`font-semibold tabular-nums ${st.tone ?? 'text-gray-800'}`}>{st.value}</span>
              </span>
            ))}
          </p>
        </div>

        {/* Right: compact 8-week trend */}
        <div className="min-w-0 lg:border-l lg:border-gray-100 lg:pl-6">
          {hasTrend ? (
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left font-medium pb-0.5 pr-2">Last {weeksBack} wks</th>
                  {cols.map(c => (
                    <th key={c.key} className="text-center font-medium pb-0.5 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TREND_DIMS.map(d => (
                  <tr key={d.key}>
                    <td className="text-gray-500 font-medium pr-2" title={d.label}>
                      {d.label}
                    </td>
                    {cols.map(c => {
                      const v = c[d.key]
                      return (
                        <td key={c.key} className="text-center py-px">
                          {v != null ? (
                            <span className={`font-semibold ${scoreTone(v)}`}>{v.toFixed(1)}</span>
                          ) : (
                            <span className="text-gray-200">–</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-400">No weekly scores in the last {weeksBack} weeks.</p>
          )}
        </div>
      </div>
    </section>
  )
}

