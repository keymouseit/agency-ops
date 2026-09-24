/**
 * Slack Incoming Webhook helpers for SalesRobot client-message alerts.
 * Never throws — missing URL or Slack failures must not break the webhook path.
 */

export type SalesRobotClientMessageAlert = {
  clientName: string
  message: string
  accountName: string
  accountId?: string
  campaignName?: string
  prospectUrl?: string
}

function getSlackWebhookUrl(): string | undefined {
  return (
    process.env.SLACK_SALESROBOT_WEBHOOK_URL?.trim() ||
    process.env.SLACK_INCOMING_WEBHOOK_URL?.trim() ||
    undefined
  )
}

/** Build plain-text + Block Kit (+ attachment fallback) for a client LinkedIn reply. */
export function formatSalesRobotClientMessage(input: SalesRobotClientMessageAlert) {
  const message = input.message?.trim() || '(no message text)'
  const accountLabel = input.accountId
    ? `${input.accountName} (\`${input.accountId}\`)`
    : input.accountName

  // Incoming-webhook / notification fallback — always includes Message.
  const lines = [
    '*New client message*',
    `*Client:* ${input.clientName}`,
    `*Account:* ${accountLabel}`,
  ]
  if (input.campaignName) {
    lines.push(`*Campaign:* ${input.campaignName}`)
  }
  if (input.prospectUrl) {
    lines.push(`*Profile:* ${input.prospectUrl}`)
  }
  lines.push(`*Message:* ${message}`)

  const text = lines.join('\n')

  // Agency Ops bot Block Kit layout — Message is its own full-width section
  // so it never gets buried under Client/Account/Campaign field pairs.
  const fields: Array<{ type: 'mrkdwn'; text: string }> = [
    { type: 'mrkdwn', text: `*Client:*\n${input.clientName}` },
    { type: 'mrkdwn', text: `*Account:*\n${input.accountName}` },
  ]
  if (input.campaignName) {
    fields.push({ type: 'mrkdwn', text: `*Campaign:*\n${input.campaignName}` })
  }

  const attachmentFields: Array<{ title: string; value: string; short: boolean }> = [
    { title: 'Client', value: input.clientName, short: true },
    { title: 'Account', value: input.accountName, short: true },
  ]
  if (input.campaignName) {
    attachmentFields.push({ title: 'Campaign', value: input.campaignName, short: true })
  }
  attachmentFields.push({ title: 'Message', value: message, short: false })

  return {
    text,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'New client message', emoji: true },
      },
      { type: 'section', fields },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Message:*\n${message}` },
      },
      ...(input.prospectUrl
        ? [
            {
              type: 'context' as const,
              elements: [
                {
                  type: 'mrkdwn' as const,
                  text: `<${input.prospectUrl}|View LinkedIn profile>`,
                },
              ],
            },
          ]
        : []),
    ],
    // Legacy attachment layout some Slack clients / workflows surface more clearly
    attachments: [
      {
        color: '#2EB67D',
        mrkdwn_in: ['text', 'fields'],
        text: `*Message:* ${message}`,
        fields: attachmentFields,
      },
    ],
  }
}

/**
 * Post a SalesRobot inbound client message to Slack.
 * No-ops (logs) when webhook URL is unset. Never throws.
 */
export async function notifySalesRobotClientMessage(
  input: SalesRobotClientMessageAlert
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const url = getSlackWebhookUrl()
  if (!url) {
    console.warn(
      '[slack] SLACK_SALESROBOT_WEBHOOK_URL (or SLACK_INCOMING_WEBHOOK_URL) missing — Slack alert skipped',
      {
        clientName: input.clientName,
        accountName: input.accountName,
        reason: 'missing_webhook_url',
      }
    )
    return { ok: true, skipped: true, reason: 'missing_webhook_url' }
  }

  const message = input.message?.trim()
  if (!message) {
    console.info('[slack] skipping client message alert — empty message text')
    return { ok: true, skipped: true, reason: 'empty_message' }
  }

  const payload = formatSalesRobotClientMessage({ ...input, message })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[slack] SalesRobot alert failed', {
        http_status: res.status,
        body: body.slice(0, 300),
      })
      return { ok: false, reason: `http_${res.status}` }
    }
    console.info('[slack] SalesRobot client message alert sent', {
      clientName: input.clientName,
      accountName: input.accountName,
      http_status: res.status,
    })
    return { ok: true }
  } catch (err) {
    console.error('[slack] SalesRobot alert error', err)
    return { ok: false, reason: 'fetch_error' }
  }
}
