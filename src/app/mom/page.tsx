import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { fmtDate, MOM_MEETING_TYPE_COLORS } from '@/lib/utils'
import { encodeMomClientKey, groupMomsByClient, isFollowUpPending, momClientKey, followUpStatusLabel } from '@/lib/mom'
import Link from 'next/link'
import MomAnalytics from './MomAnalytics'
import { differenceInDays, isSameMonth, startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function MomPage() {
  const session = await auth()
  const isFounder = session?.user?.role === 'Founder'

  const [records] = await Promise.all([
    prisma.meetingMinute.findMany({
      include: { createdBy: { select: { name: true } } },
      orderBy: [{ meetingDate: 'desc' }, { createdAt: 'desc' }],
    }),
  ])

  const today = startOfDay(new Date())
  const thisMonth = records.filter(r => isSameMonth(r.meetingDate, today)).length
  const followUpsOverdue = records.filter(r => isFollowUpPending(r) &&
    differenceInDays(startOfDay(r.followUpDate!), today) < 0
  ).length
  const followUpsUpcoming = records.filter(r => {
    if (!isFollowUpPending(r)) return false
    const d = differenceInDays(startOfDay(r.followUpDate!), today)
    return d >= 0 && d <= 7
  }).length

  const clientGroups = groupMomsByClient(records)
  const threadGroups = clientGroups.filter(g => g.meetings.length > 1)
  const meetingCountByKey = new Map(clientGroups.map(g => [g.key, g.meetings.length]))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Minutes of Meeting</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track discovery calls, demos, and client conversations with full context.
          </p>
        </div>
        <Link href="/mom/new" className="btn-primary">
          + Add New MOM
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">{records.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total meetings</div>
          <div className="text-xs text-gray-400 mt-1">{thisMonth} logged this month</div>
        </div>
        <div className={`card p-4 ${followUpsOverdue > 0 ? 'border-red-200 bg-red-50/40' : ''}`}>
          <div className={`text-2xl font-bold ${followUpsOverdue > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {followUpsOverdue}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Overdue follow-ups</div>
        </div>
        <div className={`card p-4 ${followUpsUpcoming > 0 ? 'border-blue-200 bg-blue-50/40' : ''}`}>
          <div className={`text-2xl font-bold ${followUpsUpcoming > 0 ? 'text-blue-700' : 'text-gray-900'}`}>
            {followUpsUpcoming}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Due in next 7 days</div>
        </div>
      </div>

      {isFounder && records.length > 0 && <MomAnalytics records={records} />}

      {threadGroups.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Client conversations</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Clients with more than one meeting logged — click to see the full timeline.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {threadGroups.map(group => {
              const threadHref = `/mom/client/${encodeMomClientKey(group.key)}`
              const latest = group.meetings[0]
              const earliest = group.meetings[group.meetings.length - 1]
              const typeColor = MOM_MEETING_TYPE_COLORS[latest.meetingType] ?? 'bg-gray-100 text-gray-600'

              return (
                <Link
                  key={group.key}
                  href={threadHref}
                  className="card p-4 hover:border-violet-200 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{group.clientName}</div>
                      {group.companyName && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">{group.companyName}</div>
                      )}
                    </div>
                    <span className="badge bg-violet-100 text-violet-800 shrink-0">
                      {group.meetings.length} meetings
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{fmtDate(earliest.meetingDate)} → {fmtDate(latest.meetingDate)}</span>
                    <span className="text-gray-300">·</span>
                    <span className={`badge ${typeColor}`}>Latest: {latest.meetingType}</span>
                  </div>
                  {latest.meetingOutcome && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{latest.meetingOutcome}</p>
                  )}
                  <div className="text-xs text-violet-600 font-medium mt-3 group-hover:underline">
                    View meeting timeline →
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
          <span className="text-sm font-medium text-gray-700">
            {records.length} meeting{records.length === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-gray-400">Newest first · click a row for details</span>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl mx-auto mb-3">
              📋
            </div>
            <p className="text-sm font-medium text-gray-700">No meeting minutes yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Log your first client call with outcomes, attendees, and follow-up actions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold">Meeting</th>
                  <th className="text-left px-4 py-3 font-semibold">Client</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Outcome</th>
                  <th className="text-left px-4 py-3 font-semibold">Follow-up</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Source</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Logged by</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const followUp = followUpStatusLabel(r)
                  const typeColor = MOM_MEETING_TYPE_COLORS[r.meetingType] ?? 'bg-gray-100 text-gray-600'
                  const key = momClientKey(r.clientName, r.companyName)
                  const threadCount = meetingCountByKey.get(key) ?? 1
                  const threadHref = `/mom/client/${encodeMomClientKey(key)}`

                  return (
                    <tr
                      key={r.id}
                      className="group border-b border-gray-50 last:border-0 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <Link href={`/mom/${r.id}`} className="block">
                          <div className="font-medium text-gray-900 group-hover:text-gray-950">
                            {fmtDate(r.meetingDate)}
                          </div>
                          {r.meetingTime && (
                            <div className="text-xs text-gray-400 mt-0.5">{r.meetingTime}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <Link href={`/mom/${r.id}`} className="block">
                            <div className="font-medium text-gray-900">{r.clientName}</div>
                            {r.companyName && (
                              <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">
                                {r.companyName}
                              </div>
                            )}
                          </Link>
                          {threadCount > 1 && (
                            <Link
                              href={threadHref}
                              className="inline-flex mt-1 text-[11px] font-medium text-violet-600 hover:underline"
                            >
                              {threadCount} meetings with this client
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`badge ${typeColor}`}>{r.meetingType}</span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell max-w-[200px]">
                        <p className="text-gray-600 truncate" title={r.meetingOutcome ?? undefined}>
                          {r.meetingOutcome || <span className="text-gray-300">—</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        {followUp ? (
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${followUp.cls}`}>
                            {followUp.text}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell text-gray-500 text-xs">
                        {r.leadSource || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-xs text-gray-500">{r.createdBy.name.split(' ')[0]}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/mom/${r.id}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 group-hover:text-gray-700 group-hover:bg-gray-100 transition-colors"
                          aria-label={`View ${r.clientName}`}
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
