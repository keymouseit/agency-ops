import { prisma } from '@/lib/prisma'
import { avg, scoreColor, scoreBg } from '@/lib/utils'
import { startOfWeek, subWeeks, format } from 'date-fns'
import SubmitScoreForm from './SubmitScoreForm'

export const dynamic = 'force-dynamic'

const DIMS = ['delivery', 'process', 'communication', 'growth', 'culture'] as const

export default async function TeamPage() {
  const [members, allScores] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.weeklyScore.findMany({
      where: { weekOf: { gte: subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 5) } },
      include: { member: true },
      orderBy: { weekOf: 'asc' },
    }),
  ])

  const weeks = Array.from({ length: 6 }, (_, i) =>
    startOfWeek(subWeeks(new Date(), 5 - i), { weekStartsOn: 1 })
  )
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })

  function getScore(memberId: string, weekOf: Date) {
    const weekKey = weekOf.toISOString().slice(0, 10)
    const weekScores = allScores.filter(
      s => s.memberId === memberId && s.weekOf.toISOString().slice(0, 10) === weekKey
    )
    // Prefer founder score on team page; fall back to self-assessment
    return weekScores.find(s => s.founderScore) ?? weekScores.find(s => !s.founderScore) ?? null
  }

  const memberSummaries = members.map(m => {
    const memberScores = allScores.filter(s => s.memberId === m.id)
    const recent = getScore(m.id, thisWeek)
    const overallTrend = weeks.map(w => {
      const s = getScore(m.id, w)
      return s ? avg([s.delivery, s.process, s.communication, s.growth, s.culture]) : null
    })
    const latestOverall = recent
      ? avg([recent.delivery, recent.process, recent.communication, recent.growth, recent.culture])
      : null
    const prevWeek = getScore(m.id, subWeeks(thisWeek, 1))
    const prevOverall = prevWeek
      ? avg([prevWeek.delivery, prevWeek.process, prevWeek.communication, prevWeek.growth, prevWeek.culture])
      : null
    return { member: m, recent, latestOverall, prevOverall, overallTrend, memberScores }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Team scorecards</h1>
          <p className="text-sm text-gray-500 mt-0.5">Delivery · Process · Communication · Growth · Culture — tracked weekly.</p>
        </div>
        <SubmitScoreForm members={members} founderMode />
      </div>

      {/* Score definitions */}
      <div className="card p-4 mb-6 bg-gray-50">
        <div className="grid grid-cols-5 gap-3 text-xs">
          {[
            ['Delivery', 'Commits met, milestones hit, QA pass rate, no client-found bugs'],
            ['Process', 'Rules followed: scope CO, estimation template, handover notes, test coverage'],
            ['Communication', 'Daily updates, blockers raised <1hr, client updated before they ask'],
            ['Growth', 'Same mistake not repeated, new skill applied, feedback implemented'],
            ['Culture', 'No ego, takes feedback, supports teammates, owns mistakes openly'],
          ].map(([dim, desc]) => (
            <div key={dim}>
              <div className="font-semibold text-gray-700 mb-0.5">{dim}</div>
              <div className="text-gray-400">{desc}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-6 mt-3 text-xs">
          <span className="text-green-700">8–10 = Strong</span>
          <span className="text-amber-700">6–7 = Acceptable</span>
          <span className="text-red-600">4–5 = Needs improvement</span>
          <span className="text-red-800 font-medium">1–3 = At risk — 1-on-1 required</span>
        </div>
      </div>

      {/* This week's scores */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        This week — {format(thisWeek, 'd MMM yyyy')}
      </h2>
      <div className="card overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Member</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              {DIMS.map(d => <th key={d} className="text-center px-3 py-3 font-medium">{d.slice(0, 4)}</th>)}
              <th className="text-center px-3 py-3 font-medium">Overall</th>
              <th className="text-center px-3 py-3 font-medium">vs last wk</th>
              <th className="text-center px-3 py-3 font-medium">Repeat mistake</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {memberSummaries.map(({ member, recent, latestOverall, prevOverall }) => {
              const delta = latestOverall != null && prevOverall != null ? latestOverall - prevOverall : null
              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{member.role}</td>
                  {DIMS.map(d => {
                    const val = recent ? recent[d] : null
                    return (
                      <td key={d} className="text-center px-3 py-3">
                        {val != null
                          ? <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${scoreBg(val)}`}>{val}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                  <td className="text-center px-3 py-3">
                    {latestOverall != null
                      ? <span className={`font-bold text-base ${scoreColor(latestOverall)}`}>{latestOverall}</span>
                      : <span className="text-gray-200 text-sm">No check-in</span>}
                  </td>
                  <td className="text-center px-3 py-3 text-xs">
                    {delta != null
                      ? <span className={delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}>
                          {delta > 0 ? `▲ +${delta.toFixed(1)}` : delta < 0 ? `▼ ${delta.toFixed(1)}` : '→ 0'}
                        </span>
                      : '—'}
                  </td>
                  <td className="text-center px-3 py-3">
                    {recent?.repeatedMistake
                      ? <span className="badge bg-red-100 text-red-800 text-xs">⚠ Yes</span>
                      : <span className="text-gray-200 text-xs">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 6-week trend per member */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">6-week trend by member</h2>
      <div className="grid grid-cols-2 gap-4">
        {memberSummaries.map(({ member, overallTrend }) => (
          <div key={member.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">{member.name}</span>
              <span className="text-xs text-gray-400">{member.role}</span>
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {overallTrend.map((v, i) => {
                const h = v ? Math.round((v / 10) * 100) : 0
                const color = !v ? 'bg-gray-100' : v >= 8 ? 'bg-green-400' : v >= 6 ? 'bg-amber-400' : 'bg-red-400'
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                    <span className="text-xs text-gray-400">{v ?? ''}</span>
                    <div className={`w-full rounded-sm ${color}`} style={{ height: `${Math.max(h, 4)}%` }} />
                    <span className="text-xs text-gray-300">{format(weeks[i], 'M/d')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
