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
  contact_replies: 'reply_received',
  contact_reply: 'reply_received',
  contactreplies: 'reply_received',
  when_a_contact_replies: 'reply_received',
  new_message: 'reply_received',
  prospect_replied: 'reply_received',
  prospectreplied: 'reply_received',
}

/** Metric / non-reply event types — never coerce these to reply_received. */
const KNOWN_NON_REPLY_TYPES = new Set<SalesRobotEventType>([
  'prospect_added',
  'connection_request_sent',
  'connection_accepted',
  'message_sent',
])

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
    merged.PersonName,
    merged.contactName,
    merged.contact_name,
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

/**
 * Prefer SalesRobot contact-reply fields (`newMessage`), then nested conversation /
 * threadedMessages inbound text, then legacy Zapier-style aliases.
 * When walking a thread, skip messages marked messageSentByMe === true.
 */
function lastInboundThreadText(...sources: Array<Record<string, unknown> | null | undefined>) {
  for (const src of sources) {
    if (!src) continue
    const threaded = asRecord(src.threadedMessages)
    const threadMsgs = Array.isArray(threaded?.messages)
      ? threaded!.messages
      : Array.isArray(src.messages)
        ? src.messages
        : null
    if (!threadMsgs?.length) continue
    for (let i = threadMsgs.length - 1; i >= 0; i--) {
      const m = asRecord(threadMsgs[i])
      if (!m) continue
      const byMe = pickBool(m.messageSentByMe, m.message_sent_by_me, m.sentByMe)
      if (byMe === true) continue
      const text = pickString(m.messageText, m.MessageText, m.text, m.content, m.body, m.newMessage)
      if (text) return text
    }
  }
  return undefined
}

function pickMessageText(merged: Record<string, unknown>) {
  const conversation = asRecord(merged.conversation) ?? {}
  const newMessageObj = asRecord(merged.newMessage)
  const messageObj =
    asRecord(merged.message) ??
    asRecord(merged.reply) ??
    asRecord(merged.lastMessage) ??
    asRecord(merged.LastMessage) ??
    asRecord(conversation.lastMessage) ??
    {}
  // SalesRobot inbox-style: conversation.threadedMessages.messages / root threadedMessages
  const lastInbound = lastInboundThreadText(merged, conversation, asRecord(merged.threadedMessages))

  return pickString(
    // SalesRobot "When a contact replies" — primary field seen in production webhooks
    merged.newMessage,
    typeof merged.newMessage === 'string' ? merged.newMessage : undefined,
    newMessageObj?.messageText,
    newMessageObj?.MessageText,
    newMessageObj?.text,
    newMessageObj?.content,
    newMessageObj?.body,
    conversation.newMessage,
    typeof conversation.newMessage === 'string' ? conversation.newMessage : undefined,
    conversation.messageText,
    conversation.MessageText,
    conversation.lastClientMessage,
    conversation.replyText,
    merged.messageText,
    merged.message_text,
    merged.MessageText,
    merged.Message,
    merged.messageBody,
    merged.message_body,
    merged.replyText,
    merged.reply_text,
    merged.replyMessage,
    merged.reply_message,
    merged.lastMessage,
    merged.last_message,
    merged.LastMessage,
    merged.text,
    merged.content,
    merged.body,
    // plain string fields named message / reply (not objects)
    typeof merged.message === 'string' ? merged.message : undefined,
    typeof merged.reply === 'string' ? merged.reply : undefined,
    typeof merged.Message === 'string' ? merged.Message : undefined,
    messageObj.text,
    messageObj.messageText,
    messageObj.MessageText,
    messageObj.content,
    messageObj.body,
    lastInbound
  )
}

function normalizeEventType(raw?: string): SalesRobotEventType {
  if (!raw) return 'unknown'
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return EVENT_ALIASES[key] ?? EVENT_ALIASES[key.replace(/_/g, '')] ?? 'unknown'
}

/**
 * SalesRobot "When a contact replies" webhooks often omit event_type.
 * Coerce unknown → reply_received when the payload looks like an inbound message,
 * but never override an already-known non-reply metric type.
 */
function coerceReplyReceivedIfNeeded(
  eventType: SalesRobotEventType,
  merged: Record<string, unknown>,
  messageText: string | undefined,
  messageSentByMe: boolean | undefined
): SalesRobotEventType {
  if (eventType !== 'unknown') return eventType
  if (KNOWN_NON_REPLY_TYPES.has(eventType)) return eventType

  // Clear outbound-only signal — leave as unknown (no Slack spam).
  if (messageSentByMe === true) return 'unknown'

  const hasReplyishFields = Boolean(
    pickString(
      merged.newMessage,
      merged.replyText,
      merged.reply_text,
      merged.replyMessage,
      merged.reply_message,
      merged.lastClientMessage,
      merged.last_client_message
    ) ||
      merged.isReplied === true ||
      merged.is_replied === true ||
      merged.isUnread === true ||
      merged.is_unread === true
  )

  const hasProspect =
    Boolean(
      pickString(
        merged.prospect_id,
        merged.prospectId,
        merged.prospectUuid,
        merged.nameOfPerson,
        merged.personName,
        merged.prospectName
      )
    ) || Boolean(asRecord(merged.prospect) || asRecord(merged.prospectData))

  // Prefer reply_received when: inbound flag, message body, reply-ish fields,
  // or (for this contact-replies webhook endpoint) any prospect identity with no outbound flag.
  if (
    messageSentByMe === false ||
    Boolean(messageText?.trim()) ||
    hasReplyishFields ||
    hasProspect
  ) {
    return 'reply_received'
  }

  return 'unknown'
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

/** Safe shape summary for Vercel logs — keys only, no secrets / full PII. */
export function summarizeWebhookPayloadShape(payload: unknown): {
  topKeys: string[]
  nestedKeys: Record<string, string[]>
} {
  const root = asRecord(payload)
  if (!root) return { topKeys: [], nestedKeys: {} }
  const topKeys = Object.keys(root).slice(0, 40)
  const nestedKeys: Record<string, string[]> = {}
  for (const nest of ['data', 'event', 'payload', 'message', 'prospect', 'prospectData', 'conversation', 'newMessage'] as const) {
    const child = asRecord(root[nest])
    if (child) nestedKeys[nest] = Object.keys(child).slice(0, 40)
  }
  return { topKeys, nestedKeys }
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
    const base = { ...nested, ...rec }
    // Flatten SalesRobot conversation / prospectData so name + ids resolve
    const conversation = asRecord(base.conversation) ?? {}
    const prospectData =
      asRecord(base.prospectData) ??
      asRecord(conversation.prospectData) ??
      asRecord(base.prospect) ??
      {}
    const merged = { ...prospectData, ...conversation, ...base }

    // SR "contact replies" webhooks often omit a standard event_type field.
    const rawType = pickString(
      merged.event_type,
      merged.eventType,
      merged.EventType,
      merged.type,
      merged.action,
      merged.name,
      merged.trigger,
      merged.webhook_event,
      merged.webhookEvent,
      merged.eventName,
      merged.event_name,
      merged.status,
      merged.Status
    )
    let eventType = normalizeEventType(rawType)

    const occurredAt =
      parseFlexibleDate(
        pickString(
          merged.occurred_at,
          merged.occurredAt,
          merged.timestamp,
          merged.created_at,
          merged.createdAt,
          merged.eventTime,
          merged.time,
          merged.sentTime,
          merged.sent_time
        )
      ) ?? new Date()

    const accountRec =
      asRecord(merged.account) ??
      asRecord(merged.linkedinAccount) ??
      asRecord(merged.LinkedinAccount) ??
      {}

    const messageText = pickMessageText(merged)
    const messageSentByMe = pickBool(
      merged.messageSentByMe,
      merged.message_sent_by_me,
      merged.sentByMe,
      merged.sent_by_me,
      merged.isSentByMe,
      asRecord(merged.message)?.messageSentByMe,
      asRecord(merged.lastMessage)?.messageSentByMe,
      asRecord(merged.newMessage)?.messageSentByMe,
      asRecord(merged.conversation)?.messageSentByMe
    )

    // Force reply_received for contact-replies-shaped unknowns (see coerce helper).
    eventType = coerceReplyReceivedIfNeeded(eventType, merged, messageText, messageSentByMe)

    out.push({
      externalEventId: pickString(
        merged.event_id,
        merged.eventId,
        merged.messageId,
        merged.message_id,
        merged.messageUuid,
        merged.message_uuid,
        merged.webhookEventId,
        merged.webhook_event_id,
        // Prefer message-level ids above. Bare uniqueId is a prospect key — do not
        // use it here or every reply from the same person collapses into one dedupe.
        merged.id,
        merged.uuid
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
        merged.uniqueId,
        merged.UniqueId,
        merged.unique_id,
        asRecord(merged.prospect)?.prospectUuid,
        asRecord(merged.prospect)?.uuid,
        asRecord(merged.prospect)?.uniqueId,
        asRecord(merged.prospectData)?.prospectUuid,
        asRecord(merged.prospectData)?.uniqueId
      ),
      prospectLinkedinUrl: pickString(
        merged.prospect_linkedin_url,
        merged.prospectLinkedinUrl,
        merged.profileUrl,
        asRecord(merged.prospect)?.profileUrl,
        asRecord(merged.prospectData)?.profileUrl
      ),
      prospectName: pickProspectName(merged),
      messageText,
      messageSentByMe,
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
