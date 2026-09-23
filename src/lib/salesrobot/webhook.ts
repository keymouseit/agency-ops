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
  // Inbound client message variants (SalesRobot / Zapier payloads vary)
  message_received: 'reply_received',
  messagereceived: 'reply_received',
  inbound_message: 'reply_received',
  inboundmessage: 'reply_received',
  client_message: 'reply_received',
  clientmessage: 'reply_received',
  new_message_received: 'reply_received',
  reply: 'reply_received',
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

function pickBool(...values: unknown[]): boolean | undefined {
  for (const v of values) {
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase()
      if (s === 'true' || s === '1' || s === 'yes') return true
      if (s === 'false' || s === '0' || s === 'no') return false
    }
    if (typeof v === 'number') {
      if (v === 1) return true
      if (v === 0) return false
    }
  }
  return undefined
}

function pickProspectName(merged: Record<string, unknown>) {
  const prospect = asRecord(merged.prospect) ?? asRecord(merged.prospectData) ?? {}
  const full = pickString(
    merged.nameOfPerson,
    merged.prospectName,
    merged.prospect_name,
    merged.fullName,
    merged.full_name,
    merged.clientName,
    merged.client_name,
    merged.personName,
    prospect.nameOfPerson,
    prospect.fullName,
    prospect.full_name,
    prospect.name
  )
  if (full) return full
  const first = pickString(merged.firstName, merged.first_name, prospect.firstName, prospect.first_name)
  const last = pickString(merged.lastName, merged.last_name, prospect.lastName, prospect.last_name)
  if (first || last) return [first, last].filter(Boolean).join(' ')
  return undefined
}

function pickMessageText(merged: Record<string, unknown>) {
  const messageObj = asRecord(merged.message) ?? asRecord(merged.reply) ?? {}
  return pickString(
    merged.messageText,
    merged.message_text,
    merged.messageBody,
    merged.message_body,
    merged.replyText,
    merged.reply_text,
    merged.text,
    merged.content,
    merged.body,
    // plain string fields named message / reply (not objects)
    typeof merged.message === 'string' ? merged.message : undefined,
    typeof merged.reply === 'string' ? merged.reply : undefined,
    messageObj.text,
    messageObj.messageText,
    messageObj.content,
    messageObj.body
  )
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

    const accountRec = asRecord(merged.account) ?? asRecord(merged.linkedinAccount) ?? {}

    out.push({
      externalEventId: pickString(
        merged.event_id,
        merged.eventId,
        merged.id,
        merged.uuid,
        merged.messageId,
        merged.message_id
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
        accountRec.uuid,
        accountRec.linkedinAccountUuid,
        accountRec.id
      ),
      accountName: pickString(
        merged.accountName,
        merged.account_name,
        merged.linkedinAccountName,
        merged.linkedin_account_name,
        merged.nameOnLinkedinAccount,
        accountRec.name,
        accountRec.nameOnLinkedinAccount,
        accountRec.fullName,
        accountRec.full_name
      ),
      prospectId: pickString(
        merged.prospect_id,
        merged.prospectId,
        merged.prospectUuid,
        asRecord(merged.prospect)?.prospectUuid,
        asRecord(merged.prospect)?.uuid,
        asRecord(merged.prospectData)?.prospectUuid
      ),
      prospectLinkedinUrl: pickString(
        merged.prospect_linkedin_url,
        merged.prospectLinkedinUrl,
        merged.profileUrl,
        asRecord(merged.prospect)?.profileUrl,
        asRecord(merged.prospectData)?.profileUrl
      ),
      prospectName: pickProspectName(merged),
      messageText: pickMessageText(merged),
      messageSentByMe: pickBool(
        merged.messageSentByMe,
        merged.message_sent_by_me,
        merged.sentByMe,
        merged.sent_by_me,
        asRecord(merged.message)?.messageSentByMe
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

  // SalesRobot UI has no custom-header field — allow ?secret= on the callback URL.
  let querySecret: string | null = null
  try {
    querySecret = new URL(request.url).searchParams.get('secret')
  } catch {
    querySecret = null
  }

  return header === expected || querySecret === expected
}
