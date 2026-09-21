import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'
import {
  acceptanceRate,
  addTotals,
  emptyTotals,
  endOfWeekSunday,
  replyRate,
  startOfWeekMonday,
  withRates,
} from './metrics'
import type { MetricTotals } from './types'

export type SalesRobotDatePreset =
  | 'today'
  | 'last_7_days'
  | 'this_week'
  | 'last_week'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom'

function utcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function utcDayEnd(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
}

export function resolveDateRange(input: {
  preset?: string | null
  from?: string | null
  to?: string | null
}) {
  const now = new Date()
  const today = utcDayStart(now)
  const preset = (input.preset || 'last_30_days') as SalesRobotDatePreset

  if ((preset === 'custom' || input.from || input.to) && input.from && input.to) {
    return {
      from: utcDayStart(new Date(`${input.from}T00:00:00.000Z`)),
      to: utcDayEnd(new Date(`${input.to}T00:00:00.000Z`)),
      preset: 'custom' as SalesRobotDatePreset,
    }
  }

  switch (preset) {
    case 'today':
      return { from: today, to: utcDayEnd(today), preset }
    case 'this_week': {
      const weekStart = startOfWeekMonday(today)
      return { from: weekStart, to: utcDayEnd(today), preset }
    }
    case 'last_week': {
      const thisWeek = startOfWeekMonday(today)
      const lastWeek = addDays(thisWeek, -7)
      return { from: lastWeek, to: endOfWeekSunday(lastWeek), preset }
    }
    case 'last_7_days':
      return { from: addDays(today, -6), to: utcDayEnd(today), preset }
    case 'this_month':
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
        to: utcDayEnd(today),
        preset,
      }
    case 'last_month': {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999))
      return { from: start, to: end, preset }
    }
    case 'last_30_days':
    default:
      return { from: addDays(today, -29), to: utcDayEnd(today), preset: 'last_30_days' }
  }
}

export async function upsertWeeklyAnalytics(input: {
  salesrobotCampaignId: string
  linkedinAccountId?: string | null
  campaignId?: string | null
  weekStart: Date
  totals: MetricTotals
  source?: string
}) {
  const weekStart = startOfWeekMonday(input.weekStart)
  const weekEnd = endOfWeekSunday(weekStart)
  const rates = withRates(input.totals)
  const salesrobotCampaignId = input.salesrobotCampaignId || ''
  const linkedinAccountId = input.linkedinAccountId || ''

  return prisma.salesRobotWeeklyAnalytics.upsert({
    where: {
      salesrobotCampaignId_linkedinAccountId_weekStart: {
        salesrobotCampaignId,
        linkedinAccountId,
        weekStart,
      },
    },
    create: {
      campaignId: input.campaignId ?? undefined,
      salesrobotCampaignId,
      linkedinAccountId,
      weekStart,
      weekEnd,
      ...rates,
      source: input.source ?? 'sync',
    },
    update: {
      campaignId: input.campaignId ?? undefined,
      weekEnd,
      ...rates,
      source: input.source ?? 'sync',
    },
  })
}

export async function rebuildWeeklyFromDaily(opts?: {
  from?: Date
  to?: Date
  salesrobotCampaignId?: string
  linkedinAccountId?: string
}) {
  const where: {
    date?: { gte?: Date; lte?: Date }
    salesrobotCampaignId?: string
    linkedinAccountId?: string
  } = {}
  if (opts?.from || opts?.to) {
    where.date = {}
    if (opts.from) where.date.gte = opts.from
    if (opts.to) where.date.lte = opts.to
  }
  if (opts?.salesrobotCampaignId) where.salesrobotCampaignId = opts.salesrobotCampaignId
  if (opts?.linkedinAccountId) where.linkedinAccountId = opts.linkedinAccountId

  const daily = await prisma.salesRobotDailyStat.findMany({ where })
  const campaigns = await prisma.salesRobotCampaign.findMany({
    select: { id: true, salesrobotCampaignId: true },
  })
  const campaignMap = new Map(campaigns.map(c => [c.salesrobotCampaignId, c.id]))

  type BucketKey = string
  const buckets = new Map<
    BucketKey,
    {
      salesrobotCampaignId: string
      linkedinAccountId: string
      weekStart: Date
      totals: MetricTotals
    }
  >()

  for (const row of daily) {
    const weekStart = startOfWeekMonday(row.date)
    const key = `${row.salesrobotCampaignId}|${row.linkedinAccountId}|${weekStart.toISOString()}`
    const existing = buckets.get(key) ?? {
      salesrobotCampaignId: row.salesrobotCampaignId,
      linkedinAccountId: row.linkedinAccountId,
      weekStart,
      totals: emptyTotals(),
    }
    existing.totals = addTotals(existing.totals, {
      prospectsAdded: row.prospectsAdded,
      connectionRequestsSent: row.connectionRequestsSent,
      connectionsAccepted: row.connectionsAccepted,
      messagesSent: row.messagesSent,
      repliesReceived: row.repliesReceived,
    })
    buckets.set(key, existing)
  }

  let upserted = 0
  for (const bucket of buckets.values()) {
    await upsertWeeklyAnalytics({
      salesrobotCampaignId: bucket.salesrobotCampaignId,
      linkedinAccountId: bucket.linkedinAccountId,
      campaignId: campaignMap.get(bucket.salesrobotCampaignId) ?? null,
      weekStart: bucket.weekStart,
      totals: bucket.totals,
      source: 'reconcile',
    })
    upserted += 1
  }

  return { weeks: upserted, dailyRows: daily.length }
}

export async function getAnalyticsDashboard(filters: {
  from: Date
  to: Date
  campaignId?: string | null
  linkedinAccountId?: string | null
  status?: string | null
}) {
  const [allCampaigns, allAccounts] = await Promise.all([
    prisma.salesRobotCampaign.findMany({ orderBy: { name: 'asc' } }),
    prisma.salesRobotAccount.findMany({ orderBy: { name: 'asc' } }),
  ])

  const campaignWhere: {
    salesrobotCampaignId?: string
    linkedinAccountId?: string
    status?: string
  } = {}
  if (filters.campaignId) campaignWhere.salesrobotCampaignId = filters.campaignId
  if (filters.linkedinAccountId) campaignWhere.linkedinAccountId = filters.linkedinAccountId
  if (filters.status) campaignWhere.status = filters.status

  const campaigns = allCampaigns.filter(c => {
    if (filters.campaignId && c.salesrobotCampaignId !== filters.campaignId) return false
    if (filters.linkedinAccountId && c.linkedinAccountId !== filters.linkedinAccountId) return false
    if (filters.status && c.status !== filters.status) return false
    return true
  })

  const campaignIds = campaigns.map(c => c.salesrobotCampaignId)
  const hasCampaignScope = Boolean(
    filters.campaignId || filters.linkedinAccountId || filters.status
  )
  const statusCampaignFilter =
    hasCampaignScope
      ? campaignIds.length > 0
        ? { salesrobotCampaignId: { in: campaignIds } }
        : { salesrobotCampaignId: '__none__' }
      : {}

  const [weekly, daily, recentEvents] = await Promise.all([
    prisma.salesRobotWeeklyAnalytics.findMany({
      where: {
        weekStart: { lte: filters.to },
        weekEnd: { gte: filters.from },
        ...statusCampaignFilter,
        ...(filters.linkedinAccountId ? { linkedinAccountId: filters.linkedinAccountId } : {}),
      },
      include: { campaign: { select: { name: true, status: true } } },
      orderBy: { weekStart: 'asc' },
    }),
    prisma.salesRobotDailyStat.findMany({
      where: {
        date: { gte: filters.from, lte: filters.to },
        ...statusCampaignFilter,
        ...(filters.linkedinAccountId ? { linkedinAccountId: filters.linkedinAccountId } : {}),
      },
      orderBy: { date: 'asc' },
    }),
    prisma.salesRobotEvent.findMany({
      where: {
        occurredAt: { gte: filters.from, lte: filters.to },
        ...(filters.campaignId ? { salesrobotCampaignId: filters.campaignId } : {}),
        ...(filters.linkedinAccountId ? { linkedinAccountId: filters.linkedinAccountId } : {}),
        ...(hasCampaignScope && !filters.campaignId && campaignIds.length > 0
          ? { salesrobotCampaignId: { in: campaignIds } }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: 25,
    }),
  ])

  const totals = daily.reduce(
    (acc, row) =>
      addTotals(acc, {
        prospectsAdded: row.prospectsAdded,
        connectionRequestsSent: row.connectionRequestsSent,
        connectionsAccepted: row.connectionsAccepted,
        messagesSent: row.messagesSent,
        repliesReceived: row.repliesReceived,
      }),
    emptyTotals()
  )

  // Prefer daily rollups for the selected range; fall back to weekly if daily empty
  const useTotals =
    daily.length > 0
      ? withRates(totals)
      : withRates(
          weekly.reduce(
            (acc, row) =>
              addTotals(acc, {
                prospectsAdded: row.prospectsAdded,
                connectionRequestsSent: row.connectionRequestsSent,
                connectionsAccepted: row.connectionsAccepted,
                messagesSent: row.messagesSent,
                repliesReceived: row.repliesReceived,
              }),
            emptyTotals()
          )
        )

  // Daily API often has prospectsAdded=0; use roster size for filtered campaigns.
  if (useTotals.prospectsAdded === 0) {
    useTotals.prospectsAdded = campaigns.reduce((s, c) => s + (c.totalProspectCount || 0), 0)
  }

  const weekRows = weekly.map(w => ({
    id: w.id,
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    campaignId: w.salesrobotCampaignId,
    campaignName: w.campaign?.name ?? (w.salesrobotCampaignId || 'Unknown'),
    linkedinAccountId: w.linkedinAccountId,
    prospectsAdded: w.prospectsAdded,
    connectionRequestsSent: w.connectionRequestsSent,
    connectionsAccepted: w.connectionsAccepted,
    messagesSent: w.messagesSent,
    repliesReceived: w.repliesReceived,
    acceptanceRate: w.acceptanceRate,
    replyRate: w.replyRate,
  }))

  const chartByWeek = new Map<
    string,
    MetricTotals & { weekStart: Date; label: string }
  >()
  for (const row of weekRows) {
    const key = row.weekStart.toISOString()
    const existing = chartByWeek.get(key) ?? {
      weekStart: row.weekStart,
      label: row.weekStart.toISOString().slice(0, 10),
      ...emptyTotals(),
    }
    existing.prospectsAdded += row.prospectsAdded
    existing.connectionRequestsSent += row.connectionRequestsSent
    existing.connectionsAccepted += row.connectionsAccepted
    existing.messagesSent += row.messagesSent
    existing.repliesReceived += row.repliesReceived
    chartByWeek.set(key, existing)
  }

  const trend = [...chartByWeek.values()]
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map(row => ({
      ...row,
      acceptanceRate: acceptanceRate(row.connectionsAccepted, row.connectionRequestsSent),
      replyRate: replyRate(row.repliesReceived, row.messagesSent, row.connectionsAccepted),
    }))

  const campaignNameById = new Map(allCampaigns.map(c => [c.salesrobotCampaignId, c.name]))
  const byCampaign = new Map<
    string,
    MetricTotals & { campaignId: string; name: string }
  >()
  for (const row of daily.length ? daily : weekly) {
    const id = row.salesrobotCampaignId
    const name =
      campaignNameById.get(id) ||
      ('campaignName' in row ? String(row.campaignName || id) : id)
    const existing = byCampaign.get(id) ?? {
      campaignId: id,
      name,
      ...emptyTotals(),
    }
    existing.prospectsAdded += row.prospectsAdded
    existing.connectionRequestsSent += row.connectionRequestsSent
    existing.connectionsAccepted += row.connectionsAccepted
    existing.messagesSent += row.messagesSent
    existing.repliesReceived += row.repliesReceived
    byCampaign.set(id, existing)
  }

  const lastSyncedAt = [...allCampaigns, ...allAccounts].reduce<Date | null>((latest, row) => {
    if (!('lastSyncedAt' in row) || !row.lastSyncedAt) return latest
    if (!latest || row.lastSyncedAt > latest) return row.lastSyncedAt
    return latest
  }, null)

  const filterCampaigns = filters.linkedinAccountId
    ? allCampaigns.filter(c => c.linkedinAccountId === filters.linkedinAccountId)
    : allCampaigns

  const filterStatuses = [
    ...new Set(
      (filters.linkedinAccountId ? filterCampaigns : allCampaigns)
        .map(c => c.status)
        .filter((s): s is string => Boolean(s))
    ),
  ].sort()

  return {
    configured: Boolean(process.env.SALESROBOT_API_KEY?.trim()),
    filters,
    kpis: useTotals,
    campaigns,
    accounts: allAccounts,
    filterOptions: {
      campaigns: filterCampaigns.map(c => ({
        id: c.salesrobotCampaignId,
        label: `${c.name}${c.status ? ` (${c.status})` : ''}`,
        accountId: c.linkedinAccountId || '',
        status: c.status || '',
      })),
      accounts: allAccounts.map(a => ({
        id: a.salesrobotAccountId,
        label: a.name || a.email || a.salesrobotAccountId,
      })),
      statuses: filterStatuses,
    },
    weekRows,
    trend,
    campaignComparison: [...byCampaign.values()]
      .map(c => withRates(c))
      .sort((a, b) => b.connectionRequestsSent - a.connectionRequestsSent),
    recentEvents,
    lastSyncedAt,
  }
}
