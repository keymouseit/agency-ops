/**
 * Minimal Slack Web API helpers (bot token) — no SDK dependency.
 * Used by the 15:00 IST missing-morning-plan reminder.
 *
 * Env:
 *   SLACK_BOT_TOKEN              xoxb-… (scopes: chat:write, users:read, users:read.email)
 *   SLACK_REMINDER_CHANNEL_ID    channel ID for #general (e.g. C0123ABCD); bot must be a member
 *   SLACK_REMINDER_WEBHOOK_URL   optional fallback: incoming webhook bound to #general
 *   SLACK_USER_ID_OVERRIDES      optional "email=U123,email2=U456" — wins over lookupByEmail
 *                                (use when a member's Slack email differs from their AO email)
 */

const SLACK_API = 'https://slack.com/api'

export function getSlackBotToken(): string | undefined {
  return process.env.SLACK_BOT_TOKEN?.trim() || undefined
}

/** Parse SLACK_USER_ID_OVERRIDES ("a@x.com=U1,b@x.com=U2") into a lowercase-email map. */
export function parseSlackUserIdOverrides(raw = process.env.SLACK_USER_ID_OVERRIDES): Map<string, string> {
  const map = new Map<string, string>()
  if (!raw) return map
  for (const pair of raw.split(',')) {
    const [email, id] = pair.split('=').map(s => s?.trim())
    if (email && id && /^[UW][A-Z0-9]+$/.test(id)) map.set(email.toLowerCase(), id)
  }
  return map
}

type SlackApiResult = { ok: boolean; error?: string; [k: string]: unknown }

async function slackCall(
  method: string,
  token: string,
  init: { query?: Record<string, string>; body?: unknown },
): Promise<SlackApiResult> {
  const qs = init.query ? `?${new URLSearchParams(init.query)}` : ''
  const res = await fetch(`${SLACK_API}/${method}${qs}`, {
    method: init.body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) return { ok: false, error: `http_${res.status}` }
  return (await res.json()) as SlackApiResult
}

/** users.lookupByEmail → Slack user ID, or null (not found / missing scope / error). Never throws. */
export async function lookupSlackUserIdByEmail(token: string, email: string): Promise<{ id: string | null; error?: string }> {
  try {
    const data = await slackCall('users.lookupByEmail', token, { query: { email } })
    if (!data.ok) return { id: null, error: data.error }
    const user = data.user as { id?: string; deleted?: boolean } | undefined
    if (!user?.id || user.deleted) return { id: null, error: 'user_deleted_or_missing' }
    return { id: user.id }
  } catch {
    return { id: null, error: 'fetch_error' }
  }
}

/** chat.postMessage. Never throws. */
export async function postSlackMessage(
  token: string,
  channel: string,
  text: string,
): Promise<{ ok: boolean; error?: string; ts?: string }> {
  try {
    const data = await slackCall('chat.postMessage', token, {
      body: { channel, text, unfurl_links: false, unfurl_media: false },
    })
    if (!data.ok) return { ok: false, error: data.error }
    return { ok: true, ts: data.ts as string | undefined }
  } catch {
    return { ok: false, error: 'fetch_error' }
  }
}

/** Incoming-webhook post (fallback when no bot token). Never throws. */
export async function postSlackWebhook(url: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, unfurl_links: false }),
      cache: 'no-store',
    })
    return res.ok ? { ok: true } : { ok: false, error: `http_${res.status}` }
  } catch {
    return { ok: false, error: 'fetch_error' }
  }
}
