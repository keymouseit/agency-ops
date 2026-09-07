import { NextResponse } from 'next/server'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET() {
  const startTime = Date.now()

  const authResult = await authorizeRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia', 'Manager'])
  if (authResult instanceof NextResponse) return authResult
  const { memberId } = authResult

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

export async function PATCH() {
  const startTime = Date.now()

  const authResult = await authorizeRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia', 'Manager'])
  if (authResult instanceof NextResponse) return authResult
  const { memberId } = authResult

  logger.logApiRequest('PATCH', '/api/notifications', memberId)

  const result = await prisma.notification.updateMany({
    where: { memberId, read: false },
    data: { read: true },
  })

  logger.info('Marked notifications as read', { memberId, count: result.count })
  logger.logApiResponse('PATCH', '/api/notifications', 200, Date.now() - startTime)

  return NextResponse.json({ ok: true })
}
