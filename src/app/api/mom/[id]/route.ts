import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { notify } from '@/lib/notify'
import {
  momFieldsToPrismaData,
  parseMomAttendeesJson,
  parseMomFormFields,
  splitMomAttendees,
} from '@/lib/mom-form'

const MOM_ROLES = ['BD', 'Both', 'Founder', 'Manager'] as const

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole([...MOM_ROLES])
  if (deny) return deny

  const body = await req.json().catch(() => ({}))
  if (body.followUpCompleted !== true) {
    return NextResponse.json({ error: 'Invalid update.' }, { status: 400 })
  }

  const existing = await prisma.meetingMinute.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
  }
  if (!existing.followUpDate) {
    return NextResponse.json({ error: 'This meeting has no follow-up date.' }, { status: 400 })
  }

  const record = await prisma.meetingMinute.update({
    where: { id: params.id },
    data: { followUpCompletedAt: new Date() },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  revalidatePath('/mom')
  revalidatePath(`/mom/${params.id}`)

  return NextResponse.json(record)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole([...MOM_ROLES])
  if (deny) return deny

  try {
    const { memberId } = await requireRole([...MOM_ROLES])
    const existing = await prisma.meetingMinute.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    const form = await req.formData()
    const fields = await parseMomFormFields(form, {
      keepExistingVideoPath: existing.meetingVideoPath,
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
      }),
      include: { createdBy: { select: { id: true, name: true } } },
    })

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

    return NextResponse.json(record)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update MOM'
    logger.error('Failed to update meeting minute', error as Error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
