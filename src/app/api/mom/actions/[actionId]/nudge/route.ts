import { NextResponse } from 'next/server'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { logger } from '@/lib/logger'
import { momClientLabel } from '@/lib/mom'
import { isMomActionOpenish } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Don't let a lead spam the same owner about the same action. */
const NUDGE_COOLDOWN_HOURS = 4

/**
 * POST /api/mom/actions/:actionId/nudge
 *
 * Founder / Manager "Nudge owner" from the Needs-you home. Sends the action
 * owner an in-app notification via the existing notify() helper (which already
 * skips push when no device / Firebase credentials are configured).
 * Does not change the action or the cron reminder bookkeeping.
 */
export async function POST(_req: Request, { params }: { params: { actionId: string } }) {
  const authResult = await authorizeRole(['Founder', 'Manager'])
  if (authResult instanceof NextResponse) return authResult
  const { memberId } = authResult

  try {
    const action = await prisma.momActionItem.findUnique({
      where: { id: params.actionId },
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        mom: { select: { id: true, parentId: true, clientName: true, companyName: true } },
      },
    })
    if (!action) {
      return NextResponse.json({ error: 'Action not found.' }, { status: 404 })
    }
    if (!isMomActionOpenish(action.status)) {
      return NextResponse.json({ error: 'This action is already closed.' }, { status: 400 })
    }
    if (action.ownerId === memberId) {
      return NextResponse.json({ error: 'You own this action.' }, { status: 400 })
    }

    const link = `/mom/${action.mom.parentId ?? action.mom.id}`
    const since = new Date(Date.now() - NUDGE_COOLDOWN_HOURS * 60 * 60 * 1000)
    const recent = await prisma.notification.findFirst({
      where: {
        memberId: action.ownerId,
        type: 'mom_action_nudge',
        linkTo: link,
        message: { contains: action.title },
        createdAt: { gte: since },
      },
      select: { id: true },
    })
    if (recent) {
      return NextResponse.json({ ok: true, alreadyNudged: true })
    }

    const actor = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { name: true },
    })
    await notify(
      'mom_action_nudge',
      [action.ownerId],
      `${actor?.name ?? 'Your lead'} is waiting on “${action.title}” for ${momClientLabel(action.mom.clientName, action.mom.companyName)}`,
      link
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Failed to nudge MOM action owner', error as Error, { actionId: params.actionId })
    return NextResponse.json({ error: 'Could not nudge the owner.' }, { status: 500 })
  }
}
