import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listNotificationEmailGroups,
  NOTIFICATION_PURPOSES,
  setNotificationEmails,
  type NotificationPurpose,
} from '@/lib/notification-emails'

const SETTINGS_ROLES = ['Founder', 'Manager']

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !SETTINGS_ROLES.includes(session.user.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const groups = await listNotificationEmailGroups()
    return NextResponse.json({ groups, canEdit: session.user.role === 'Founder' })
  } catch (error) {
    console.error('Failed to load notification emails:', error)
    return NextResponse.json({ error: 'Failed to load notification emails' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'Founder') {
    return NextResponse.json({ error: 'Only a Founder can change notification emails.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const purpose = body.purpose as NotificationPurpose
  if (!NOTIFICATION_PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: 'Unknown notification list.' }, { status: 400 })
  }
  if (!Array.isArray(body.emails)) {
    return NextResponse.json({ error: 'emails must be an array.' }, { status: 400 })
  }

  try {
    const emails = await setNotificationEmails(purpose, body.emails)
    return NextResponse.json({ purpose, emails })
  } catch (error) {
    console.error('Failed to save notification emails:', error)
    return NextResponse.json({ error: 'Failed to save notification emails' }, { status: 500 })
  }
}
