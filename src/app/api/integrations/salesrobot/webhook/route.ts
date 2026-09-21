import { NextResponse } from 'next/server'
import { processSalesRobotWebhook, verifyWebhookSecret } from '@/lib/salesrobot'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await request.json()
    console.info('[salesrobot] webhook received', {
      integration: 'salesrobot',
      event_type: typeof payload?.event_type === 'string' ? payload.event_type : undefined,
      type: typeof payload?.type === 'string' ? payload.type : undefined,
    })

    const result = await processSalesRobotWebhook(payload)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[salesrobot] webhook error', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
