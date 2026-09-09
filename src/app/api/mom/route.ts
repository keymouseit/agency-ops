import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { checkRole, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { momClientKey } from '@/lib/mom'
import { notify } from '@/lib/notify'
import { momFieldsToPrismaData, parseMomFormFields, setMomThreadFinalStatus } from '@/lib/mom-form'

const MOM_ROLES = ['BD', 'Both', 'Founder', 'Manager'] as const

export async function GET() {
  const deny = await checkRole([...MOM_ROLES])
  if (deny) return deny

  const records = await prisma.meetingMinute.findMany({
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ meetingDate: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(records)
}

export async function POST(req: Request) {
  const deny = await checkRole([...MOM_ROLES])
  if (deny) return deny

  try {
    const { memberId } = await requireRole([...MOM_ROLES])
    const form = await req.formData()
    const fields = await parseMomFormFields(form)

    let parentId: string | null = null
    if (fields.parentId) {
      const parent = await prisma.meetingMinute.findUnique({
        where: { id: fields.parentId },
        select: { id: true, parentId: true },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Original MOM not found.' }, { status: 400 })
      }
      parentId = parent.parentId ?? parent.id
    }

    const record = await prisma.meetingMinute.create({
      data: {
        ...momFieldsToPrismaData(fields),
        parentId,
        createdById: memberId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    await setMomThreadFinalStatus(parentId ?? record.id, fields.finalStatus)

    const clientKey = momClientKey(fields.clientName, fields.companyName)
    const pendingSameClient = await prisma.meetingMinute.findMany({
      where: {
        id: { not: record.id },
        clientName: fields.clientName,
        followUpDate: { not: null },
        followUpCompletedAt: null,
      },
    })
    const toComplete = pendingSameClient.filter(
      m => momClientKey(m.clientName, m.companyName) === clientKey
    )
    if (toComplete.length) {
      await prisma.meetingMinute.updateMany({
        where: { id: { in: toComplete.map(m => m.id) } },
        data: { followUpCompletedAt: fields.meetingDate },
      })
    }

    const notifyIds = fields.attendeeMemberIds.filter(id => id !== memberId)
    if (notifyIds.length) {
      const creatorName = record.createdBy.name
      const companyLabel = fields.companyName ? ` · ${fields.companyName}` : ''
      await notify(
        'mom_attendee',
        notifyIds,
        `${creatorName} added you as an attendee on a MOM: ${fields.clientName}${companyLabel} (${fields.meetingType})`,
        `/mom/${record.id}`
      )
    }

    if (fields.campaignCallId) {
      await prisma.campaignCall.updateMany({
        where: { id: fields.campaignCallId, momId: null },
        data: {
          momId: record.id,
          status: 'completed',
          completedAt: fields.meetingDate,
        },
      })
    }

    return NextResponse.json(
      { ...record, threadRootId: parentId ?? record.id },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Your session is out of date. Please sign out and sign in again.' },
        { status: 401 }
      )
    }
    const status = (error as { status?: number })?.status === 400 ? 400 : 400
    const message = error instanceof Error ? error.message : 'Failed to create MOM'
    logger.error('Failed to create meeting minute', error as Error)
    return NextResponse.json({ error: message }, { status })
  }
}
