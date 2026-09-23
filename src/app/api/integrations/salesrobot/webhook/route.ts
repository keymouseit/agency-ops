import { NextResponse } from 'next/server'
import {
  normalizeWebhookPayload,
  processSalesRobotWebhook,
  summarizeWebhookPayloadShape,
  verifyWebhookSecret,
} from '@/lib/salesrobot'

export const dynamic = 'force-dynamic'

/** Browser / SalesRobot health checks often GET the URL — keep POST for real events. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    integration: 'salesrobot',
    message: 'Webhook is live. SalesRobot must POST reply events here for Slack alerts.',
    accepts: ['POST'],
  })
}

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await request.json()
    const shape = summarizeWebhookPayloadShape(payload)
    const normalized = normalizeWebhookPayload(payload)
    const first = normalized[0]
    const msgPreview = first?.messageText?.trim().slice(0, 80)
    const willAttemptSlack =
      Boolean(first) &&
      (first!.eventType === 'reply_received' ||
        (first!.eventType === 'unknown' &&
          first!.messageSentByMe === false &&
          Boolean(first!.messageText?.trim()))) &&
      Boolean(first!.messageText?.trim())

    console.info('[salesrobot] webhook received', {
      integration: 'salesrobot',
      topKeys: shape.topKeys,
      nestedKeys: shape.nestedKeys,
      eventCount: normalized.length,
      eventType: first?.eventType,
      hasMessageText: Boolean(first?.messageText?.trim()),
      messagePreview: msgPreview || undefined,
      messageSentByMe: first?.messageSentByMe,
      prospectId: first?.prospectId,
      willAttemptSlack,
    })

    const result = await processSalesRobotWebhook(payload)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[salesrobot] webhook error', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
