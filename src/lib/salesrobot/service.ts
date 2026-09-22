import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { upsertWeeklyAnalytics } from './analytics'
import { emptyTotals, startOfWeekMonday } from './metrics'
import type { MetricTotals, NormalizedWebhookEvent, SalesRobotEventType } from './types'
import { buildDedupeKey, normalizeWebhookPayload } from './webhook'

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
    },
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

    await prisma.salesRobotEvent.update({
      where: { dedupeKey },
      data: { processed: true },
    })
    processed += 1
  }

  return { received: events.length, stored, duplicates, processed }
}
