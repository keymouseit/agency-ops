import { differenceInDays, endOfMonth, startOfDay, startOfMonth } from 'date-fns'
import { fmtDate } from '@/lib/utils'
import { followUpStatusLabel, isFollowUpPending, isFollowUpUpcoming } from '@/lib/mom'

export const CAMPAIGN_CHANNELS = ['LinkedIn', 'Email', 'Other'] as const
export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const
export const CALL_STATUSES = ['scheduled', 'completed', 'no_show', 'cancelled'] as const

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
}

export const CALL_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

export type CallWithMom = {
  id: string
  clientName: string
  companyName: string | null
  scheduledDate: Date
  scheduledTime: string | null
  status: string
  mom: {
    id: string
    meetingType: string
    followUpDate: Date | null
    followUpCompletedAt: Date | null
  } | null
}

export function callScheduleLabel(date: Date, time?: string | null) {
  const days = differenceInDays(startOfDay(date), startOfDay(new Date()))
  let dayLabel: string
  if (days < 0) dayLabel = `${Math.abs(days)}d ago`
  else if (days === 0) dayLabel = 'Today'
  else if (days === 1) dayLabel = 'Tomorrow'
  else if (days <= 7) dayLabel = `In ${days}d`
  else dayLabel = fmtDate(date)
  return time ? `${dayLabel} · ${time}` : dayLabel
}

export function momFollowUpBadge(mom: CallWithMom['mom']) {
  if (!mom?.followUpDate) return null
  if (mom.followUpCompletedAt) {
    return { text: 'Follow-up done', cls: 'bg-green-50 text-green-700 border-green-100' }
  }
  return followUpStatusLabel(mom)
}

export type CampaignCallStatsInput = {
  status: string
  scheduledDate: Date
  momId: string | null
  mom: { followUpDate: Date | null; followUpCompletedAt: Date | null } | null
}

export type CampaignCallStats = {
  total: number
  scheduled: number
  completed: number
  withMom: number
  needsMom: number
  callsToday: number
  callsThisWeek: number
  callsThisMonth: number
  followUpsDue: number
  followUpsOverdue: number
  followUpsToday: number
  followUpsThisWeek: number
  followUpsUpcoming: number
  followUpsDone: number
}

export function computeCampaignCallStats(
  calls: CampaignCallStatsInput[],
  today = startOfDay(new Date())
): CampaignCallStats {
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const scheduled = calls.filter(c => c.status === 'scheduled')
  const upcomingScheduled = scheduled.filter(c => startOfDay(c.scheduledDate) >= today)

  const dayDiff = (date: Date) => differenceInDays(startOfDay(date), today)

  const callsToday = upcomingScheduled.filter(c => dayDiff(c.scheduledDate) === 0).length
  const callsThisWeek = upcomingScheduled.filter(c => {
    const d = dayDiff(c.scheduledDate)
    return d >= 0 && d <= 7
  }).length
  const callsThisMonth = upcomingScheduled.filter(c => {
    const d = startOfDay(c.scheduledDate)
    return d >= today && d >= monthStart && d <= monthEnd
  }).length

  const withFollowUp = calls.filter(c => c.mom?.followUpDate)
  const followUpsDone = withFollowUp.filter(c => c.mom!.followUpCompletedAt).length
  const pendingFollowUps = withFollowUp.filter(c => isFollowUpPending(c.mom!))

  const followUpDayDiff = (c: CampaignCallStatsInput) =>
    differenceInDays(startOfDay(c.mom!.followUpDate!), today)

  const followUpsOverdue = pendingFollowUps.filter(c => followUpDayDiff(c) < 0).length
  const followUpsToday = pendingFollowUps.filter(c => followUpDayDiff(c) === 0).length
  const followUpsThisWeek = pendingFollowUps.filter(c => {
    const d = followUpDayDiff(c)
    return d >= 0 && d <= 7
  }).length
  const followUpsUpcoming = pendingFollowUps.filter(c => isFollowUpUpcoming(c.mom!, today)).length

  return {
    total: calls.length,
    scheduled: scheduled.length,
    completed: calls.filter(c => c.status === 'completed').length,
    withMom: calls.filter(c => c.momId).length,
    needsMom: calls.filter(c => c.status === 'completed' && !c.momId).length,
    callsToday,
    callsThisWeek,
    callsThisMonth,
    followUpsDue: followUpsOverdue + followUpsToday,
    followUpsOverdue,
    followUpsToday,
    followUpsThisWeek,
    followUpsUpcoming,
    followUpsDone,
  }
}
