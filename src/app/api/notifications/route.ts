import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/notifications — fetch recent notifications for the logged-in user
export async function GET() {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const session = await auth()
  const memberId = session!.user.id

  const notifications = await prisma.notification.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const unread = notifications.filter(n => !n.read).length

  return NextResponse.json({ notifications, unread })
}

// PATCH /api/notifications — mark all as read for the logged-in user
export async function PATCH() {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const session = await auth()
  const memberId = session!.user.id

  await prisma.notification.updateMany({
    where: { memberId, read: false },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
