import { createHash } from 'crypto'
import type { NormalizedWebhookEvent, SalesRobotEventType } from './types'
import { parseFlexibleDate } from './metrics'

const EVENT_ALIASES: Record<string, SalesRobotEventType> = {
  prospect_added: 'prospect_added',
  prospectadded: 'prospect_added',
  lead_added: 'prospect_added',
  new_prospect: 'prospect_added',
  connection_request_sent: 'connection_request_sent',
  connectionrequestsent: 'connection_request_sent',
  invite_sent: 'connection_request_sent',
  connection_sent: 'connection_request_sent',
  connection_accepted: 'connection_accepted',
  connectionaccepted: 'connection_accepted',
  new_connection: 'connection_accepted',
  connected: 'connection_accepted',
  message_sent: 'message_sent',
  messagesent: 'message_sent',
  reply_received: 'reply_received',
  replyreceived: 'reply_received',
  new_reply: 'reply_received',
  replied: 'reply_received',
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pickString(...values: unknown[]) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return undefined
}

function normalizeEventType(raw?: string): SalesRobotEventType {
  if (!raw) return 'unknown'
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return EVENT_ALIASES[key] ?? EVENT_ALIASES[key.replace(/_/g, '')] ?? 'unknown'
}

export function buildDedupeKey(input: {
  externalEventId?: string
  eventType: string
  salesrobotCampaignId?: string
  prospectId?: string
  occurredAt: Date
}) {
  if (input.externalEventId) return `ext:${input.externalEventId}`
  const base = [
    input.eventType,
    input.salesrobotCampaignId ?? '',
    input.prospectId ?? '',
    input.occurredAt.toISOString(),
  ].join('|')
  return `hash:${createHash('sha256').update(base).digest('hex').slice(0, 40)}`
}

/** Normalize flexible SalesRobot / Zapier-style webhook payloads. */
export function normalizeWebhookPayload(payload: unknown): NormalizedWebhookEvent[] {
  const root = asRecord(payload)
  if (!root) return []

  const eventsNode = root.events ?? root.data ?? root.event
  const list = Array.isArray(eventsNode)
    ? eventsNode
    : eventsNode
      ? [eventsNode]
      : [root]

  const out: NormalizedWebhookEvent[] = []

  for (const item of list) {
    const rec = asRecord(item) ?? root
    const nested = asRecord(rec.data) ?? asRecord(rec.payload) ?? {}
    const merged = { ...nested, ...rec }

    const eventType = normalizeEventType(
      pickString(merged.event_type, merged.eventType, merged.type, merged.action, merged.name)
    )

    const occurredAt =
      parseFlexibleDate(
        pickString(
          merged.occurred_at,
          merged.occurredAt,
          merged.timestamp,
          merged.created_at,
          merged.createdAt,
          merged.eventTime,
          merged.time
        )
      ) ?? new Date()

    out.push({
      externalEventId: pickString(
        merged.event_id,
        merged.eventId,
        merged.id,
        merged.uuid,
        merged.messageId
      ),
      eventType,
      salesrobotCampaignId: pickString(
        merged.campaign_id,
        merged.campaignId,
        merged.campaignUuid,
        merged.campaignUUID,
        asRecord(merged.campaign)?.uuid,
        asRecord(merged.campaign)?.id
      ),
      campaignName: pickString(
        merged.campaign_name,
        merged.campaignName,
        asRecord(merged.campaign)?.name
      ),
      linkedinAccountId: pickString(
        merged.linkedin_account_id,
        merged.linkedinAccountId,
        merged.linkedinAccountUuid,
        merged.accountUuid,
        asRecord(merged.account)?.uuid
      ),
      prospectId: pickString(
        merged.prospect_id,
        merged.prospectId,
        merged.prospectUuid,
        asRecord(merged.prospect)?.prospectUuid,
        asRecord(merged.prospect)?.uuid
      ),
      prospectLinkedinUrl: pickString(
        merged.prospect_linkedin_url,
        merged.prospectLinkedinUrl,
        merged.profileUrl,
        asRecord(merged.prospect)?.profileUrl
      ),
      occurredAt,
      raw: merged,
    })
  }

  return out
}

export function verifyWebhookSecret(request: Request) {
  const expected = process.env.SALESROBOT_WEBHOOK_SECRET?.trim()
  if (!expected) return true

  const header =
    request.headers.get('x-salesrobot-secret') ||
    request.headers.get('x-webhook-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  return header === expected
}
