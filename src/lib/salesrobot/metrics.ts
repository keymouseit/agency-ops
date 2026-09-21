import type { MetricRates, MetricTotals } from './types'

/** Acceptance rate = connections accepted / connection requests sent * 100 */
export function acceptanceRate(accepted: number, requestsSent: number) {
  if (!requestsSent) return 0
  return Math.round((accepted / requestsSent) * 1000) / 10
}

/**
 * Reply rate = replies / messages sent * 100 (stable across date ranges).
 * Falls back to replies / connections when no messages were recorded.
 */
export function replyRate(replies: number, messagesSent: number, connectionsAccepted = 0) {
  if (messagesSent > 0) {
    return Math.round((replies / messagesSent) * 1000) / 10
  }
  if (connectionsAccepted > 0) {
    return Math.round((replies / connectionsAccepted) * 1000) / 10
  }
  return 0
}

export function withRates<T extends MetricTotals>(totals: T): T & MetricRates {
  return {
    ...totals,
    acceptanceRate: acceptanceRate(totals.connectionsAccepted, totals.connectionRequestsSent),
    replyRate: replyRate(
      totals.repliesReceived,
      totals.messagesSent,
      totals.connectionsAccepted
    ),
  }
}

/** Format a rate for UI; show dash when the denominator is missing. */
export function formatRatePercent(rate: number, denominator: number) {
  if (!denominator) return '—'
  return `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`
}

export function emptyTotals(): MetricTotals {
  return {
    prospectsAdded: 0,
    connectionRequestsSent: 0,
    connectionsAccepted: 0,
    messagesSent: 0,
    repliesReceived: 0,
  }
}

export function addTotals(a: MetricTotals, b: MetricTotals): MetricTotals {
  return {
    prospectsAdded: a.prospectsAdded + b.prospectsAdded,
    connectionRequestsSent: a.connectionRequestsSent + b.connectionRequestsSent,
    connectionsAccepted: a.connectionsAccepted + b.connectionsAccepted,
    messagesSent: a.messagesSent + b.messagesSent,
    repliesReceived: a.repliesReceived + b.repliesReceived,
  }
}

export function messagesSentFromCampaign(c: {
  firstEmailSentCount?: number
  followUpSentCount?: number
  inMailMessageCount?: number
  voiceMessageSentCount?: number
  videoMessageSentCount?: number
  groupMessageSentCount?: number
  eventMessageSentCount?: number
}) {
  return (
    (c.firstEmailSentCount ?? 0) +
    (c.followUpSentCount ?? 0) +
    (c.inMailMessageCount ?? 0) +
    (c.voiceMessageSentCount ?? 0) +
    (c.videoMessageSentCount ?? 0) +
    (c.groupMessageSentCount ?? 0) +
    (c.eventMessageSentCount ?? 0)
  )
}

export function metricsFromCampaignDto(c: {
  prospectsAdded?: number
  totalProspectCount?: number
  connectionRequestSentCount?: number
  connectionRequestAcceptedCount?: number
  repliedCount?: number
  firstEmailSentCount?: number
  followUpSentCount?: number
  inMailMessageCount?: number
  voiceMessageSentCount?: number
  videoMessageSentCount?: number
  groupMessageSentCount?: number
  eventMessageSentCount?: number
}): MetricTotals {
  return {
    // Only use daily prospectsAdded — never fall back to roster totalProspectCount
    // (that inflated weekly "Prospects" to campaign size like 1000).
    prospectsAdded: c.prospectsAdded ?? 0,
    connectionRequestsSent: c.connectionRequestSentCount ?? 0,
    connectionsAccepted: c.connectionRequestAcceptedCount ?? 0,
    messagesSent: messagesSentFromCampaign(c),
    repliesReceived: c.repliedCount ?? 0,
  }
}

export function startOfWeekMonday(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function endOfWeekSunday(weekStart: Date) {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + 6)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

export function parseFlexibleDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) return d
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`)
  }
  return null
}

export function toDateOnlyIso(date: Date) {
  return date.toISOString().slice(0, 10)
}
