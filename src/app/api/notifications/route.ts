import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// GET /api/notifications — fetch recent notifications for the logged-in user
export async function GET() {
  const startTime = Date.now()

  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia', 'Manager'])
  if (deny) return deny

  const session = await auth()
  const memberId = session!.user.id

  logger.logApiRequest('GET', '/api/notifications', memberId)

  const notifications = await prisma.notification.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const unread = notifications.filter(n => !n.read).length

  logger.info('Fetched notifications', { memberId, count: notifications.length, unread })
  logger.logApiResponse('GET', '/api/notifications', 200, Date.now() - startTime)

  return NextResponse.json({ notifications, unread })
}

// PATCH /api/notifications — mark all as read for the logged-in user
export async function PATCH() {
  const startTime = Date.now()

  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia', 'Manager'])
  if (deny) return deny

  const session = await auth()
  const memberId = session!.user.id

  logger.logApiRequest('PATCH', '/api/notifications', memberId)

  const result = await prisma.notification.updateMany({
    where: { memberId, read: false },
    data: { read: true },
  })

  logger.info('Marked notifications as read', { memberId, count: result.count })
  logger.logApiResponse('PATCH', '/api/notifications', 200, Date.now() - startTime)

  return NextResponse.json({ ok: true })
}
