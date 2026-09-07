import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { fmtDate } from '@/lib/utils'
import {
  CAMPAIGN_STATUS_COLORS,
  CALL_STATUS_COLORS,
  callScheduleLabel,
  momFollowUpBadge,
} from '@/lib/campaigns'
import { isFollowUpDue, isFollowUpUpcoming } from '@/lib/mom'
import Link from 'next/link'
import { addDays, startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const session = await auth()
  const isFounder = session?.user?.role === 'Founder' || session?.user?.role === 'Manager'

  const [campaigns, allCalls] = await Promise.all([
    prisma.campaign.findMany({
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { calls: true } },
        calls: {
          include: {
            mom: {
              select: {
                id: true,
                meetingType: true,
                followUpDate: true,
                followUpCompletedAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.campaignCall.findMany({
      include: {
        campaign: { select: { name: true, channel: true } },
        mom: {
          select: {
            id: true,
            meetingType: true,
            followUpDate: true,
            followUpCompletedAt: true,
          },
        },
      },
      orderBy: [{ scheduledDate: 'asc' }],
    }),
  ])

  const today = startOfDay(new Date())
  const weekEnd = addDays(today, 7)

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const scheduledUpcoming = allCalls.filter(
    c => c.status === 'scheduled' && startOfDay(c.scheduledDate) >= today
  )
  const scheduledNext7 = scheduledUpcoming.filter(
    c => startOfDay(c.scheduledDate) <= weekEnd
  ).length
  const completedCalls = allCalls.filter(c => c.status === 'completed').length
  const completedNoMom = allCalls.filter(c => c.status === 'completed' && !c.momId).length
  const followUpsDue = allCalls.filter(c => c.mom && isFollowUpDue(c.mom)).length
  const followUpsUpcoming = allCalls.filter(c => c.mom && isFollowUpUpcoming(c.mom)).length

  const upcomingCalls = allCalls
    .filter(c => c.status === 'scheduled' && startOfDay(c.scheduledDate) >= today)
    .slice(0, 8)

  const recentCompleted = allCalls
    .filter(c => c.status === 'completed')
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, 6)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            LinkedIn outreach → scheduled calls → MOM → follow-ups.
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">+ New campaign</Link>
      </div>

      {isFounder && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <div className="card p-4">
            <div className="text-2xl font-bold text-gray-900">{activeCampaigns}</div>
            <div className="text-xs text-gray-500 mt-0.5">Active campaigns</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-blue-700">{scheduledNext7}</div>
            <div className="text-xs text-gray-500 mt-0.5">Calls in next 7 days</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-gray-900">{scheduledUpcoming.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Upcoming scheduled</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-green-700">{completedCalls}</div>
            <div className="text-xs text-gray-500 mt-0.5">Calls completed</div>
          </div>
          <div className={`card p-4 ${followUpsDue > 0 ? 'border-amber-200 bg-amber-50/40' : ''}`}>
            <div className={`text-2xl font-bold ${followUpsDue > 0 ? 'text-amber-800' : 'text-gray-900'}`}>
              {followUpsDue}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Follow-ups due</div>
          </div>
          <div className={`card p-4 ${followUpsUpcoming > 0 ? 'border-blue-200 bg-blue-50/40' : ''}`}>
            <div className={`text-2xl font-bold ${followUpsUpcoming > 0 ? 'text-blue-700' : 'text-gray-900'}`}>
              {followUpsUpcoming}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Upcoming follow-ups</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Upcoming calls</h2>
          {upcomingCalls.length === 0 ? (
            <p className="text-sm text-gray-400">No calls scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {upcomingCalls.map(c => (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.campaignId}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.clientName}</div>
                    <div className="text-xs text-gray-400 truncate">{c.campaign.name}</div>
                  </div>
                  <span className="text-xs text-blue-700 shrink-0">
                    {callScheduleLabel(c.scheduledDate, c.scheduledTime)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recently completed</h2>
          {recentCompleted.length === 0 ? (
            <p className="text-sm text-gray-400">No completed calls yet.</p>
          ) : (
            <div className="space-y-2">
              {recentCompleted.map(c => {
                const followUp = momFollowUpBadge(c.mom)
                return (
                  <div key={c.id} className="p-3 rounded-lg border border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{c.clientName}</div>
                        <div className="text-xs text-gray-400">{c.campaign.name}</div>
                      </div>
                      {c.mom ? (
                        <Link href={`/mom/${c.mom.id}`} className="text-xs text-violet-600 hover:underline shrink-0">
                          View MOM →
                        </Link>
                      ) : (
                        <Link
                          href={`/mom/new?callId=${c.id}`}
                          className="text-xs text-amber-600 hover:underline shrink-0"
                        >
                          Log MOM →
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`badge text-xs ${CALL_STATUS_COLORS.completed}`}>completed</span>
                      {c.mom && (
                        <span className="badge text-xs bg-violet-100 text-violet-800">{c.mom.meetingType}</span>
                      )}
                      {followUp && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${followUp.cls}`}>
                          {followUp.text}
                        </span>
                      )}
                      {!c.mom && (
                        <span className="text-xs text-amber-700">MOM not logged</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {completedNoMom > 0 && (
            <p className="text-xs text-amber-700 mt-3">
              {completedNoMom} completed call{completedNoMom === 1 ? '' : 's'} still need a MOM.
            </p>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <span className="text-sm font-medium text-gray-700">All campaigns</span>
        </div>
        {campaigns.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-gray-500">No campaigns yet. Create your first LinkedIn campaign.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold">Campaign</th>
                  <th className="text-left px-4 py-3 font-semibold">Channel</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Calls</th>
                  <th className="text-left px-4 py-3 font-semibold">Scheduled</th>
                  <th className="text-left px-4 py-3 font-semibold">Completed</th>
                  <th className="text-left px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const scheduled = c.calls.filter(x => x.status === 'scheduled').length
                  const done = c.calls.filter(x => x.status === 'completed').length
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3.5 text-gray-600">{c.channel}</td>
                      <td className="px-4 py-3.5">
                        <span className={`badge ${CAMPAIGN_STATUS_COLORS[c.status] ?? 'bg-gray-100'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">{c._count.calls}</td>
                      <td className="px-4 py-3.5 text-blue-700">{scheduled}</td>
                      <td className="px-4 py-3.5 text-green-700">{done}</td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs">{c.createdBy.name.split(' ')[0]}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/campaigns/${c.id}`} className="text-gray-400 hover:text-gray-700">→</Link>
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
