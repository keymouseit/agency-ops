import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { notify } from '@/lib/notify'
import {
  notifyMomActionAssigned,
  notifyMomActionBlocked,
  notifyMomActionStatusChanged,
  notifyMomFollowupCompleted,
  ownersNeedingAssignmentNotify,
} from '@/lib/mom-notify'
import {
  getMomFinalStatus,
  momFieldsToPrismaData,
  parseMomAttendeesJson,
  parseMomFormFields,
  setMomThreadFinalStatus,
  splitMomAttendees,
} from '@/lib/mom-form'
import { getThreadBlockingActions, replaceMomActionItems } from '@/lib/mom-actions'
import { isMomActionClosed, isMomActionStatus, MOM_FINAL_STATUSES, type MomActionStatus } from '@/lib/utils'
import { istDateInputValue } from '@/lib/ist'

const MOM_ROLES = ['BD', 'Both', 'Founder', 'Manager'] as const

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole([...MOM_ROLES])
  if (deny) return deny

  try {
    const { memberId, role } = await requireRole([...MOM_ROLES])
    const body = await req.json().catch(() => ({}))
    const existing = await prisma.meetingMinute.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    // Update a single action item status
    if (body.actionId && typeof body.actionStatus === 'string') {
      if (!isMomActionStatus(body.actionStatus)) {
        return NextResponse.json({ error: 'Invalid action status.' }, { status: 400 })
      }
      const action = await prisma.momActionItem.findFirst({
        where: { id: body.actionId, momId: params.id },
      })
      if (!action) {
        return NextResponse.json({ error: 'Action not found on this MOM.' }, { status: 404 })
      }

      const isOwner = action.ownerId === memberId
      const isLead = role === 'Founder' || role === 'Manager'
      if (!isOwner && !isLead) {
        return NextResponse.json(
          { error: 'Only the action owner, Founder, or Manager can update status.' },
          { status: 403 }
        )
      }
      // Once a closed/final outcome, only Founder/Manager may change status (reopen / retarget).
      if (
        isMomActionClosed(action.status) &&
        body.actionStatus !== action.status &&
        !isLead
      ) {
        return NextResponse.json(
          {
            error:
              'Only Founder or Manager can change status after Completed / Not completed / Skipped.',
          },
          { status: 403 }
        )
      }
      const needsReason = body.actionStatus === 'Blocked' || body.actionStatus === 'Skipped'
      const blockedReason = needsReason
        ? (typeof body.blockedReason === 'string' && body.blockedReason.trim()
            ? body.blockedReason.trim()
            : null)
        : null
      if (needsReason && !blockedReason) {
        return NextResponse.json(
          {
            error:
              body.actionStatus === 'Skipped'
                ? 'Skipped reason is required when marking an action Skipped.'
                : 'Blocked reason is required when marking an action Blocked.',
          },
          { status: 400 }
        )
      }

      const updated = await prisma.momActionItem.update({
        where: { id: action.id },
        data: {
          status: body.actionStatus,
          blockedReason,
          completedAt: body.actionStatus === 'Done' ? new Date() : null,
        },
        include: { owner: { select: { id: true, name: true, role: true } } },
      })

      const rootId = existing.parentId ?? existing.id
      const statusChanged = action.status !== body.actionStatus

      if (statusChanged) {
        const actor = await prisma.teamMember.findUnique({
          where: { id: memberId },
          select: { name: true },
        })
        await notifyMomActionStatusChanged({
          actorId: memberId,
          actorName: actor?.name ?? 'Someone',
          actionTitle: action.title,
          oldStatus: action.status,
          newStatus: body.actionStatus,
          clientName: existing.clientName,
          companyName: existing.companyName,
          momLinkId: rootId,
        })
      }

      revalidatePath('/mom')
      revalidatePath(`/mom/${rootId}`)
      revalidatePath(`/mom/${params.id}`)

      return NextResponse.json(updated)
    }

    if (typeof body.finalStatus === 'string' && body.followUpCompleted !== true) {
      if (role !== 'Founder' && role !== 'Manager') {
        return NextResponse.json(
          { error: 'Only Founder or Manager can change Deal status.' },
          { status: 403 }
        )
      }
      if (!MOM_FINAL_STATUSES.includes(body.finalStatus as (typeof MOM_FINAL_STATUSES)[number])) {
        return NextResponse.json({ error: 'Invalid Deal status.' }, { status: 400 })
      }

      const rootId = existing.parentId ?? existing.id
      await setMomThreadFinalStatus(rootId, body.finalStatus)

      const record = await prisma.meetingMinute.findUnique({
        where: { id: params.id },
        include: { createdBy: { select: { id: true, name: true } } },
      })

      revalidatePath('/mom')
      revalidatePath(`/mom/${rootId}`)
      revalidatePath(`/mom/${params.id}`)

      return NextResponse.json({ ...record, finalStatus: body.finalStatus })
    }

    if (body.followUpCompleted !== true) {
      return NextResponse.json({ error: 'Invalid update.' }, { status: 400 })
    }

    if (!existing.followUpDate) {
      return NextResponse.json({ error: 'This meeting has no next call date.' }, { status: 400 })
    }

    const outcome =
      typeof body.outcome === 'string' ? body.outcome.trim() : ''
    if (!outcome) {
      return NextResponse.json(
        { error: 'Outcome is required to complete the next call.' },
        { status: 400 }
      )
    }

    const nextAction = body.nextAction === 'no_further' ? 'no_further' : body.nextAction === 'schedule_next' ? 'schedule_next' : null
    if (!nextAction) {
      return NextResponse.json(
        { error: 'Choose “Schedule next call” or “No further call”.' },
        { status: 400 }
      )
    }

    const attendedRaw = typeof body.attendedDate === 'string' ? body.attendedDate.trim() : ''
    const attendedDate = attendedRaw ? new Date(attendedRaw) : new Date()
    if (Number.isNaN(attendedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid attended date.' }, { status: 400 })
    }

    const todayKey = istDateInputValue()
    const attendedKey = attendedRaw || todayKey

    let nextFollowUpDate: Date | null = null
    let nextFinalStatus: string | null = null

    if (nextAction === 'schedule_next') {
      const nextRaw = typeof body.nextFollowUpDate === 'string' ? body.nextFollowUpDate.trim() : ''
      if (!nextRaw) {
        return NextResponse.json({ error: 'Next call date is required.' }, { status: 400 })
      }
      nextFollowUpDate = new Date(nextRaw)
      if (Number.isNaN(nextFollowUpDate.getTime())) {
        return NextResponse.json({ error: 'Invalid next call date.' }, { status: 400 })
      }
      const floor = attendedKey < todayKey ? todayKey : attendedKey
      if (nextRaw < floor) {
        return NextResponse.json(
          { error: `Next call date must be on or after ${floor}.` },
          { status: 400 }
        )
      }
    } else {
      const statusRaw = typeof body.finalStatus === 'string' ? body.finalStatus.trim() : ''
      if (statusRaw !== 'Hold' && statusRaw !== 'Closed') {
        return NextResponse.json(
          { error: 'Deal status must be Hold or Closed when choosing no further call.' },
          { status: 400 }
        )
      }
      nextFinalStatus = statusRaw
    }

    const blocking = await getThreadBlockingActions(params.id)
    if (blocking.length) {
      const lines = blocking.map(a => `• “${a.title}” (${a.status})`)
      return NextResponse.json(
        {
          error: `Cannot complete next call while these actions are still Open or In progress:\n${lines.join('\n')}\nMark them Done, Not completed, Skipped (with reason), or Blocked (with reason) first.`,
          blockingActionIds: blocking.map(a => a.id),
        },
        { status: 400 }
      )
    }

    const stamp = `[Next call ${attendedKey}] ${outcome}`
    const prevRows = await prisma.$queryRaw<Array<{ followUpOutcome: string | null }>>`
      SELECT "followUpOutcome" FROM "MeetingMinute" WHERE id = ${params.id} LIMIT 1
    `
    const prevOutcome = prevRows[0]?.followUpOutcome ?? null
    const followUpOutcome = prevOutcome ? `${prevOutcome}\n${stamp}` : stamp

    const rootId = existing.parentId ?? existing.id

    // Always mark this MOM's pending next-call as completed (outcome + timestamp).
    // schedule_next: keep this MOM's followUpDate as the call just logged; create a child MOM for the new date.
    // no_further: keep followUpDate; set Hold/Closed on the thread.
    await prisma.$executeRaw`
      UPDATE "MeetingMinute"
      SET "followUpOutcome" = ${followUpOutcome},
          "followUpCompletedAt" = ${attendedDate},
          "updatedAt" = ${new Date()}
      WHERE id = ${params.id}
    `

    let newFollowUpMomId: string | null = null

    if (nextAction === 'schedule_next' && nextFollowUpDate) {
      // Match manual "+ Add follow-up": parentId → thread root, meetingType Follow-up,
      // client/company/contact/industry/lead source copied. Action items left empty so BD
      // sets a fresh plan when logging the call. meetingDate + followUpDate = scheduled date
      // (meetingDate drives thread tabs; followUpDate drives Complete-next-call on the child).
      const seedOutcome = `Scheduled from previous call on ${attendedKey}: ${outcome}`
      const child = await prisma.meetingMinute.create({
        data: {
          parentId: rootId,
          createdById: memberId,
          clientName: existing.clientName,
          companyName: existing.companyName,
          clientLinkedIn: existing.clientLinkedIn,
          companyLinkedIn: existing.companyLinkedIn,
          clientEmail: existing.clientEmail,
          clientPhone: existing.clientPhone,
          domain: existing.domain,
          leadSource: existing.leadSource,
          meetingType: 'Follow-up',
          meetingDate: nextFollowUpDate,
          followUpDate: nextFollowUpDate,
          followUpCompletedAt: null,
          meetingOutcome: seedOutcome,
          attendees: existing.attendees,
          nextActionItem: null,
        },
      })
      newFollowUpMomId = child.id

      // Align child deal status with the thread (raw SQL — same stale-client workaround as setMomThreadFinalStatus).
      const threadStatus = await getMomFinalStatus(rootId)
      await prisma.$executeRaw`
        UPDATE "MeetingMinute"
        SET "finalStatus" = ${threadStatus}, "updatedAt" = ${new Date()}
        WHERE id = ${child.id}
      `
    }

    if (nextFinalStatus) {
      await setMomThreadFinalStatus(rootId, nextFinalStatus)
    }

    const record = await prisma.meetingMinute.findUnique({
      where: { id: params.id },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    const actor = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { name: true },
    })
    await notifyMomFollowupCompleted({
      actorId: memberId,
      actorName: actor?.name ?? 'Someone',
      createdById: existing.createdById,
      clientName: existing.clientName,
      companyName: existing.companyName,
      momLinkId: newFollowUpMomId ?? rootId,
      rootId,
      nextAction,
      outcome,
      nextFollowUpDate: nextAction === 'schedule_next' ? nextFollowUpDate : null,
      finalStatus: nextFinalStatus,
    })

    revalidatePath('/mom')
    revalidatePath(`/mom/${rootId}`)
    revalidatePath(`/mom/${params.id}`)
    if (newFollowUpMomId) {
      revalidatePath(`/mom/${newFollowUpMomId}`)
    }

    return NextResponse.json({
      ...record,
      followUpOutcome,
      followUpDate: existing.followUpDate,
      followUpCompletedAt: attendedDate,
      ...(nextFinalStatus ? { finalStatus: nextFinalStatus } : {}),
      ...(newFollowUpMomId ? { newFollowUpMomId } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update status.'
    logger.error('Failed to patch meeting minute', error as Error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole([...MOM_ROLES])
  if (deny) return deny

  try {
    const { memberId, role } = await requireRole([...MOM_ROLES])
    const isLead = role === 'Founder' || role === 'Manager'

    const existing = await prisma.meetingMinute.findUnique({
      where: { id: params.id },
      include: {
        actionItems: {
          orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    const form = await req.formData()

    // Empty plan: any MOM editor (BD/Both/…) may set actions once.
    // Non-empty: only Founder/Manager can rewrite what/owner/due; ignore form actions for others.
    const hasExistingActions = existing.actionItems.length > 0
    const canEditActionPlan = isLead || !hasExistingActions
    const lockedActionItems = !canEditActionPlan
      ? existing.actionItems.map((a, index) => ({
          id: a.id,
          title: a.title,
          ownerId: a.ownerId,
          dueDate: a.dueDate,
          status: a.status as MomActionStatus,
          blockedReason: a.blockedReason,
          sortOrder: a.sortOrder ?? index,
        }))
      : undefined

    const fields = await parseMomFormFields(form, {
      keepExistingVideoPath: existing.meetingVideoPath,
      lockedActionItems,
    })

    const prevAttendees = parseMomAttendeesJson(existing.attendees)
    const members = await prisma.teamMember.findMany({
      where: { active: true },
      select: { id: true, name: true },
    })
    const prevSplit = splitMomAttendees(prevAttendees, members)
    const newlyAdded = fields.attendeeMemberIds.filter(id => !prevSplit.memberIds.includes(id) && id !== memberId)

    const followUpChanged =
      (existing.followUpDate?.toISOString().slice(0, 10) ?? null) !==
      (fields.followUpDate?.toISOString().slice(0, 10) ?? null)
    const clearFollowUpCompletion = !fields.followUpDate || followUpChanged

    const record = await prisma.meetingMinute.update({
      where: { id: params.id },
      data: momFieldsToPrismaData(fields, {
        followUpCompletedAt: clearFollowUpCompletion ? null : existing.followUpCompletedAt,
        // Preserve legacy summary text when plan is locked (even if summarize differs slightly)
        ...(canEditActionPlan ? {} : { nextActionItem: existing.nextActionItem }),
      }),
      include: { createdBy: { select: { id: true, name: true } } },
    })

    if (canEditActionPlan) {
      const newlyAssignedOwnerIds = ownersNeedingAssignmentNotify(
        existing.actionItems,
        fields.actionItems,
        memberId
      )
      await replaceMomActionItems(params.id, fields.actionItems)

      if (newlyAssignedOwnerIds.length) {
        await notifyMomActionAssigned({
          actorId: memberId,
          ownerIds: newlyAssignedOwnerIds,
          clientName: fields.clientName,
          companyName: fields.companyName,
          momLinkId: existing.parentId ?? existing.id,
        })
      }

      // If Founder/Manager set an action to Blocked via plan edit, notify leads
      const prevById = new Map(existing.actionItems.map(a => [a.id, a]))
      const actor = await prisma.teamMember.findUnique({
        where: { id: memberId },
        select: { name: true },
      })
      const actorName = actor?.name ?? 'Someone'
      const rootId = existing.parentId ?? existing.id
      for (const a of fields.actionItems) {
        if (a.status !== 'Blocked' || !a.blockedReason) continue
        const prev = a.id ? prevById.get(a.id) : undefined
        const newlyBlocked = !prev || prev.status !== 'Blocked'
        if (!newlyBlocked) continue
        await notifyMomActionBlocked({
          actorId: memberId,
          actorName,
          createdById: existing.createdById,
          actionTitle: a.title,
          clientName: fields.clientName,
          companyName: fields.companyName,
          blockedReason: a.blockedReason,
          momLinkId: rootId,
        })
      }
    }
    await setMomThreadFinalStatus(existing.parentId ?? existing.id, fields.finalStatus)

    if (newlyAdded.length) {
      const editorName =
        (await prisma.teamMember.findUnique({ where: { id: memberId }, select: { name: true } }))?.name ??
        'Someone'
      const companyLabel = fields.companyName ? ` · ${fields.companyName}` : ''
      await notify(
        'mom_attendee',
        newlyAdded,
        `${editorName} added you as an attendee on a MOM: ${fields.clientName}${companyLabel} (${fields.meetingType})`,
        `/mom/${record.id}`
      )
    }

    revalidatePath('/mom')
    revalidatePath(`/mom/${params.id}`)
    revalidatePath(`/mom/${params.id}/edit`)

    const withActions = await prisma.meetingMinute.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        actionItems: {
          include: { owner: { select: { id: true, name: true } } },
          orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
        },
      },
    })

    return NextResponse.json(withActions)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update MOM'
    logger.error('Failed to update meeting minute', error as Error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
