import { prisma } from '@/lib/prisma'
import { fmtDate } from '@/lib/utils'
import {
  CALL_STATUS_COLORS,
  callScheduleLabel,
  computeCampaignCallStats,
  momFollowUpBadge,
} from '@/lib/campaigns'
import { isFollowUpPending } from '@/lib/mom'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { startOfDay } from 'date-fns'
import ScheduleCallModal from '../ScheduleCallModal'
import CallActions from '../CallActions'
import FollowUpQuickAction from '../FollowUpQuickAction'
import CampaignStatusSelect from '../CampaignStatusSelect'

export const dynamic = 'force-dynamic'

function StatPill({
  value,
  label,
  tone = 'neutral',
}: {
  value: number
  label: string
  tone?: 'neutral' | 'blue' | 'green' | 'violet' | 'amber' | 'red' | 'slate'
}) {
  const tones = {
    neutral: 'bg-gray-50 border-gray-100 text-gray-800',
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    green: 'bg-green-50 border-green-100 text-green-800',
    violet: 'bg-violet-50 border-violet-100 text-violet-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    red: 'bg-red-50 border-red-100 text-red-800',
    slate: 'bg-slate-50 border-slate-100 text-slate-700',
  }
  const labelTones = {
    neutral: 'text-gray-500',
    blue: 'text-blue-600',
    green: 'text-green-600',
    violet: 'text-violet-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    slate: 'text-slate-500',
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${tones[tone]}`}>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className={`text-[10px] uppercase tracking-wide font-medium mt-1 ${labelTones[tone]}`}>
        {label}
      </div>
    </div>
  )
}

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      calls: {
        include: {
          createdBy: { select: { name: true } },
          mom: {
            select: {
              id: true,
              meetingType: true,
              meetingOutcome: true,
              followUpDate: true,
              followUpCompletedAt: true,
            },
          },
        },
        orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
      },
    },
  })

  if (!campaign) notFound()

  const stats = computeCampaignCallStats(campaign.calls)
  const today = startOfDay(new Date())

  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-4">
        ← <Link href="/campaigns" className="hover:text-gray-700">Campaigns</Link>
      </div>

      {/* Hero + stats */}
      <div className="card p-5 sm:p-6 mb-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden">
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <CampaignStatusSelect campaignId={campaign.id} currentStatus={campaign.status} />
              <span className="badge bg-white text-gray-600 border border-gray-200">{campaign.channel}</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{campaign.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Created by {campaign.createdBy.name}
              {campaign.startDate && ` · ${fmtDate(campaign.startDate)}`}
              {campaign.endDate && ` → ${fmtDate(campaign.endDate)}`}
            </p>
            {campaign.objective && (
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap leading-relaxed line-clamp-3">
                {campaign.objective}
              </p>
            )}
            {campaign.notes && (
              <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap line-clamp-2">
                {campaign.notes}
              </p>
            )}
          </div>

          <div className="lg:col-span-3 grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Overview</p>
              <div className="grid grid-cols-2 gap-2">
                <StatPill value={stats.scheduled} label="Scheduled" tone="blue" />
                <StatPill value={stats.completed} label="Completed" tone="green" />
                <StatPill value={stats.withMom} label="MOM logged" tone="violet" />
                {/* <StatPill
                  value={stats.needsMom}
                  label="Needs MOM"
                  tone={stats.needsMom > 0 ? 'amber' : 'neutral'}
                /> */}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Upcoming calls</p>
              <div className="grid grid-cols-1 gap-2">
                <StatPill value={stats.callsToday} label="Today" tone={stats.callsToday > 0 ? 'blue' : 'neutral'} />
                <StatPill value={stats.callsThisWeek} label="This week" tone={stats.callsThisWeek > 0 ? 'blue' : 'neutral'} />
                <StatPill value={stats.callsThisMonth} label="This month" tone={stats.callsThisMonth > 0 ? 'blue' : 'neutral'} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Follow-ups</p>
              <div className="grid grid-cols-2 gap-2">
                <StatPill value={stats.followUpsDue} label="Due now" tone={stats.followUpsDue > 0 ? 'amber' : 'neutral'} />
                <StatPill value={stats.followUpsOverdue} label="Overdue" tone={stats.followUpsOverdue > 0 ? 'red' : 'neutral'} />
                <StatPill value={stats.followUpsThisWeek} label="This week" tone={stats.followUpsThisWeek > 0 ? 'blue' : 'neutral'} />
                <StatPill value={stats.followUpsUpcoming} label="Upcoming" tone={stats.followUpsUpcoming > 0 ? 'slate' : 'neutral'} />
                <StatPill value={stats.followUpsDone} label="Done" tone="green" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calls table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Calls & meetings
            <span className="font-normal text-gray-400 ml-2">
              {stats.total} total · {stats.callsToday} today · {stats.callsThisWeek} this week
            </span>
          </h2>
          <ScheduleCallModal
            campaignId={campaign.id}
            campaignName={campaign.name}
            channel={campaign.channel}
          />
        </div>

        {campaign.calls.length === 0 ? (
          <div className="text-center py-10 px-6">
            <p className="text-sm text-gray-500">No calls yet — schedule from LinkedIn replies.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/40">
                  <th className="text-left px-4 py-2 font-semibold">Client</th>
                  <th className="text-left px-3 py-2 font-semibold">When</th>
                  <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">Details</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-4 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaign.calls.map(c => {
                  const followUp = momFollowUpBadge(c.mom)
                  const isScheduled = c.status === 'scheduled'
                  const isToday = startOfDay(c.scheduledDate).getTime() === today.getTime()
                  const hasPendingFollowUp = c.mom && isFollowUpPending(c.mom)

                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-gray-50 hover:bg-slate-50/60 ${
                        isScheduled ? (isToday ? 'bg-amber-50/30' : 'bg-blue-50/20') : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{c.clientName}</div>
                        {c.companyName && (
                          <div className="text-xs text-gray-500">{c.companyName}</div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1 md:hidden">
                          {followUp && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${followUp.cls}`}>
                              {followUp.text}
                            </span>
                          )}
                          {hasPendingFollowUp && (
                            <FollowUpQuickAction momId={c.mom!.id} compact />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {callScheduleLabel(c.scheduledDate, c.scheduledTime)}
                        <div className="text-gray-400">{c.createdBy.name.split(' ')[0]}</div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {c.mom && (
                            <span className="badge text-[10px] bg-violet-100 text-violet-800">{c.mom.meetingType}</span>
                          )}
                          {followUp && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${followUp.cls}`}>
                              {followUp.text}
                            </span>
                          )}
                          {hasPendingFollowUp && (
                            <FollowUpQuickAction momId={c.mom!.id} compact />
                          )}
                        </div>
                        {c.notes && (
                          <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{c.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`badge text-[10px] ${CALL_STATUS_COLORS[c.status] ?? 'bg-gray-100'}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <CallActions callId={c.id} status={c.status} momId={c.momId} compact />
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
