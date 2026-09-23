import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { upsertWeeklyAnalytics } from './analytics'
import { emptyTotals, startOfWeekMonday } from './metrics'
import type { MetricTotals, NormalizedWebhookEvent, SalesRobotEventType } from './types'
import { buildDedupeKey, normalizeWebhookPayload } from './webhook'
import { notifySalesRobotClientMessage } from '@/lib/slack/notify'

function metricDelta(eventType: SalesRobotEventType): Partial<MetricTotals> | null {
  switch (eventType) {
    case 'prospect_added':
      return { prospectsAdded: 1 }
    case 'connection_request_sent':
      return { connectionRequestsSent: 1 }
    case 'connection_accepted':
      return { connectionsAccepted: 1 }
    case 'message_sent':
      return { messagesSent: 1 }
    case 'reply_received':
      return { repliesReceived: 1 }
    default:
      return null
  }
}

async function applyProspectSideEffects(event: NormalizedWebhookEvent) {
  if (!event.prospectId) return

  const existing = await prisma.salesRobotProspect.findUnique({
    where: { salesrobotProspectId: event.prospectId },
  })

  const data: Prisma.SalesRobotProspectUpdateInput = {}
  if (event.eventType === 'connection_request_sent') {
    data.connectionRequestedAt = event.occurredAt
  }
  if (event.eventType === 'connection_accepted') {
    data.isConnected = true
    data.connectedAt = event.occurredAt
  }
  if (event.eventType === 'message_sent') {
    data.firstMessageSentAt = event.occurredAt
  }
  if (event.eventType === 'reply_received') {
    data.isReplied = true
    // Keep first repliedAt; reopen follow-up if BD had marked it done
    if (!existing?.repliedAt) {
      data.repliedAt = event.occurredAt
    }
    data.followUpCompletedAt = null
    if (event.messageText?.trim()) {
      data.lastClientMessage = event.messageText.trim()
      data.lastClientMessageAt = event.occurredAt
    }
    if (event.prospectName && !existing?.firstName && !existing?.lastName) {
      const parts = event.prospectName.trim().split(/\s+/)
      if (parts[0]) data.firstName = parts[0]
      if (parts.length > 1) data.lastName = parts.slice(1).join(' ')
    }
  }

  if (existing) {
    if (Object.keys(data).length) {
      await prisma.salesRobotProspect.update({
        where: { salesrobotProspectId: event.prospectId },
        data,
      })
    }
    return
  }

  const campaign = event.salesrobotCampaignId
    ? await prisma.salesRobotCampaign.findUnique({
        where: { salesrobotCampaignId: event.salesrobotCampaignId },
      })
    : null

  await prisma.salesRobotProspect.create({
    data: {
      salesrobotProspectId: event.prospectId,
      campaignId: campaign?.id,
      salesrobotCampaignId: event.salesrobotCampaignId,
      linkedinAccountId: event.linkedinAccountId,
      linkedinUrl: event.prospectLinkedinUrl,
      addedAt: event.eventType === 'prospect_added' ? event.occurredAt : undefined,
      connectionRequestedAt:
        event.eventType === 'connection_request_sent' ? event.occurredAt : undefined,
      connectedAt: event.eventType === 'connection_accepted' ? event.occurredAt : undefined,
      firstMessageSentAt: event.eventType === 'message_sent' ? event.occurredAt : undefined,
      repliedAt: event.eventType === 'reply_received' ? event.occurredAt : undefined,
      isConnected: event.eventType === 'connection_accepted',
      isReplied: event.eventType === 'reply_received',
      lastClientMessage:
        event.eventType === 'reply_received' && event.messageText?.trim()
          ? event.messageText.trim()
          : undefined,
      lastClientMessageAt:
        event.eventType === 'reply_received' && event.messageText?.trim()
          ? event.occurredAt
          : undefined,
      firstName:
        event.eventType === 'reply_received' && event.prospectName
          ? event.prospectName.trim().split(/\s+/)[0]
          : undefined,
      lastName:
        event.eventType === 'reply_received' && event.prospectName
          ? event.prospectName.trim().split(/\s+/).slice(1).join(' ') || undefined
          : undefined,
    },
  })
}

/** True when this webhook event should fan out a Slack client-message alert. */
function shouldNotifySlack(event: NormalizedWebhookEvent): boolean {
  // Prefer explicit inbound reply events; never spam on connection/prospect metrics.
  if (event.eventType === 'reply_received') return true
  // Rare: unknown event that clearly marks an inbound client message.
  if (event.eventType === 'unknown' && event.messageSentByMe === false && event.messageText?.trim()) {
    return true
  }
  return false
}

async function resolveAccountName(event: NormalizedWebhookEvent): Promise<string> {
  if (event.accountName?.trim()) return event.accountName.trim()
  if (event.linkedinAccountId) {
    const account = await prisma.salesRobotAccount.findUnique({
      where: { salesrobotAccountId: event.linkedinAccountId },
      select: { name: true, email: true },
    })
    if (account?.name?.trim()) return account.name.trim()
    if (account?.email?.trim()) return account.email.trim()
  }
  return event.linkedinAccountId || 'Unknown account'
}

async function resolveClientName(event: NormalizedWebhookEvent): Promise<string> {
  if (event.prospectName?.trim()) return event.prospectName.trim()
  if (event.prospectId) {
    const prospect = await prisma.salesRobotProspect.findUnique({
      where: { salesrobotProspectId: event.prospectId },
      select: { firstName: true, lastName: true },
    })
    const name = [prospect?.firstName, prospect?.lastName].filter(Boolean).join(' ').trim()
    if (name) return name
  }
  return 'Unknown client'
}

async function maybeNotifySlackClientMessage(event: NormalizedWebhookEvent) {
  if (!shouldNotifySlack(event)) return

  const message = event.messageText?.trim()
  // Keep webhook fast — do not invent text or fetch inbox APIs when body is missing.
  if (!message) {
    console.info('[salesrobot] skip Slack alert — reply_received without message text', {
      prospectId: event.prospectId,
      externalEventId: event.externalEventId,
    })
    return
  }

  const [clientName, accountName] = await Promise.all([
    resolveClientName(event),
    resolveAccountName(event),
  ])

  await notifySalesRobotClientMessage({
    clientName,
    message,
    accountName,
    accountId: event.linkedinAccountId,
    campaignName: event.campaignName,
    prospectUrl: event.prospectLinkedinUrl,
  })
}

async function bumpWeeklyFromEvent(event: NormalizedWebhookEvent) {
  const delta = metricDelta(event.eventType)
  if (!delta || !event.salesrobotCampaignId) return

  const weekStart = startOfWeekMonday(event.occurredAt)
  const linkedinAccountId = event.linkedinAccountId || ''
  const salesrobotCampaignId = event.salesrobotCampaignId

  const existing = await prisma.salesRobotWeeklyAnalytics.findUnique({
    where: {
      salesrobotCampaignId_linkedinAccountId_weekStart: {
        salesrobotCampaignId,
        linkedinAccountId,
        weekStart,
      },
    },
  })

  const totals = emptyTotals()
  if (existing) {
    totals.prospectsAdded = existing.prospectsAdded
    totals.connectionRequestsSent = existing.connectionRequestsSent
    totals.connectionsAccepted = existing.connectionsAccepted
    totals.messagesSent = existing.messagesSent
    totals.repliesReceived = existing.repliesReceived
  }

  totals.prospectsAdded += delta.prospectsAdded ?? 0
  totals.connectionRequestsSent += delta.connectionRequestsSent ?? 0
  totals.connectionsAccepted += delta.connectionsAccepted ?? 0
  totals.messagesSent += delta.messagesSent ?? 0
  totals.repliesReceived += delta.repliesReceived ?? 0

  const campaign = await prisma.salesRobotCampaign.findUnique({
    where: { salesrobotCampaignId },
    select: { id: true },
  })

  await upsertWeeklyAnalytics({
    salesrobotCampaignId,
    linkedinAccountId,
    campaignId: campaign?.id ?? null,
    weekStart,
    totals,
    source: 'webhook',
  })

  // Also bump daily row for the event day
  const dayStart = new Date(
    Date.UTC(event.occurredAt.getUTCFullYear(), event.occurredAt.getUTCMonth(), event.occurredAt.getUTCDate())
  )
  const daily = await prisma.salesRobotDailyStat.findUnique({
    where: {
      date_salesrobotCampaignId_linkedinAccountId: {
        date: dayStart,
        salesrobotCampaignId,
        linkedinAccountId,
      },
    },
  })

  await prisma.salesRobotDailyStat.upsert({
    where: {
      date_salesrobotCampaignId_linkedinAccountId: {
        date: dayStart,
        salesrobotCampaignId,
        linkedinAccountId,
      },
    },
    create: {
      date: dayStart,
      salesrobotCampaignId,
      campaignName: event.campaignName,
      linkedinAccountId,
      prospectsAdded: delta.prospectsAdded ?? 0,
      connectionRequestsSent: delta.connectionRequestsSent ?? 0,
      connectionsAccepted: delta.connectionsAccepted ?? 0,
      messagesSent: delta.messagesSent ?? 0,
      repliesReceived: delta.repliesReceived ?? 0,
    },
    update: {
      prospectsAdded: (daily?.prospectsAdded ?? 0) + (delta.prospectsAdded ?? 0),
      connectionRequestsSent:
        (daily?.connectionRequestsSent ?? 0) + (delta.connectionRequestsSent ?? 0),
      connectionsAccepted: (daily?.connectionsAccepted ?? 0) + (delta.connectionsAccepted ?? 0),
      messagesSent: (daily?.messagesSent ?? 0) + (delta.messagesSent ?? 0),
      repliesReceived: (daily?.repliesReceived ?? 0) + (delta.repliesReceived ?? 0),
      campaignName: event.campaignName ?? daily?.campaignName,
    },
  })
}

export async function processSalesRobotWebhook(payload: unknown) {
  const events = normalizeWebhookPayload(payload)
  let stored = 0
  let duplicates = 0
  let processed = 0

  for (const event of events) {
    const dedupeKey = buildDedupeKey({
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      salesrobotCampaignId: event.salesrobotCampaignId,
      prospectId: event.prospectId,
      occurredAt: event.occurredAt,
    })

    const campaign = event.salesrobotCampaignId
      ? await prisma.salesRobotCampaign.findUnique({
          where: { salesrobotCampaignId: event.salesrobotCampaignId },
        })
      : null

    try {
      await prisma.salesRobotEvent.create({
        data: {
          externalEventId: event.externalEventId,
          dedupeKey,
          eventType: event.eventType,
          campaignId: campaign?.id,
          salesrobotCampaignId: event.salesrobotCampaignId,
          campaignName: event.campaignName,
          linkedinAccountId: event.linkedinAccountId,
          prospectId: event.prospectId,
          prospectLinkedinUrl: event.prospectLinkedinUrl,
          occurredAt: event.occurredAt,
          rawPayload: JSON.stringify(event.raw),
          processed: false,
        },
      })
      stored += 1
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        duplicates += 1
        continue
      }
      throw err
    }

    await applyProspectSideEffects(event)
    await bumpWeeklyFromEvent(event)

    // Only notify on newly inserted events (duplicates already continued above).
    await maybeNotifySlackClientMessage(event)

    await prisma.salesRobotEvent.update({
      where: { dedupeKey },
      data: { processed: true },
    })
    processed += 1
  }

  return { received: events.length, stored, duplicates, processed }
}
