import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { checkRole, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { momClientKey } from '@/lib/mom'
import { MOM_MEETING_TYPES } from '@/lib/utils'
import { notify } from '@/lib/notify'

const MOM_ROLES = ['BD', 'Both', 'Founder', 'Manager'] as const

function parseDate(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function str(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

async function saveMeetingVideo(file: File | null) {
  if (!file || file.size === 0) return null
  if (file.size > 200 * 1024 * 1024) {
    throw new Error('Video must be under 200 MB')
  }
  const ext = path.extname(file.name).toLowerCase()
  const allowedExt = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
  if (!allowedExt.includes(ext)) {
    throw new Error('Unsupported video format. Use MP4, WebM, MOV, AVI, or MKV.')
  }
  const filename = `${randomUUID()}${ext}`
  const dir = path.join(process.cwd(), 'public', 'uploads', 'mom')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return `/uploads/mom/${filename}`
}

async function resolveAttendees(form: FormData) {
  const ids = form.getAll('attendeeIds').filter((v): v is string => typeof v === 'string' && v.trim() !== '')

  let custom: { name: string; role: string }[] = []
  const customRaw = str(form.get('customAttendees'))
  if (customRaw) {
    try {
      const parsed = JSON.parse(customRaw) as unknown
      if (Array.isArray(parsed)) {
        custom = parsed
          .filter((a): a is { name: string; role: string } =>
            !!a && typeof a === 'object' && typeof a.name === 'string' && a.name.trim() !== ''
          )
          .map(a => ({ name: a.name.trim(), role: (a.role?.trim() || 'Guest') }))
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const members = ids.length
    ? await prisma.teamMember.findMany({
        where: { id: { in: ids }, active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      })
    : []

  const all = [
    ...members.map(m => ({ name: m.name, role: m.role })),
    ...custom,
  ]

  if (!all.length) return { json: null as string | null, memberIds: [] as string[] }

  return {
    json: JSON.stringify(all),
    memberIds: members.map(m => m.id),
  }
}

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

    const clientName = str(form.get('clientName'))
    const meetingType = str(form.get('meetingType'))
    const meetingDate = parseDate(form.get('meetingDate'))

    if (!clientName) {
      return NextResponse.json({ error: 'Client name is required.' }, { status: 400 })
    }
    if (!meetingDate) {
      return NextResponse.json({ error: 'Meeting date is required.' }, { status: 400 })
    }
    if (!meetingType || !MOM_MEETING_TYPES.includes(meetingType as typeof MOM_MEETING_TYPES[number])) {
      return NextResponse.json({ error: 'Valid meeting type is required.' }, { status: 400 })
    }

    const videoFile = form.get('meetingVideo')
    const meetingVideoPath = videoFile instanceof File && videoFile.size > 0
      ? await saveMeetingVideo(videoFile)
      : null
    const meetingVideoUrl = str(form.get('meetingVideoUrl'))
    const { json: attendees, memberIds: attendeeMemberIds } = await resolveAttendees(form)

    const record = await prisma.meetingMinute.create({
      data: {
        meetingDate,
        meetingTime: str(form.get('meetingTime')),
        clientName,
        clientLinkedIn: str(form.get('clientLinkedIn')),
        companyName: str(form.get('companyName')),
        companyLinkedIn: str(form.get('companyLinkedIn')),
        clientEmail: str(form.get('clientEmail')),
        clientPhone: str(form.get('clientPhone')),
        meetingType,
        meetingOutcome: str(form.get('meetingOutcome')),
        attendees,
        domain: str(form.get('domain')),
        clientPainPoints: str(form.get('clientPainPoints')),
        ourApproach: str(form.get('ourApproach')),
        requirementsFromClient: str(form.get('requirementsFromClient')),
        followUpDate: parseDate(form.get('followUpDate')),
        meetingVideoPath,
        meetingVideoUrl,
        leadSource: str(form.get('leadSource')),
        nextActionItem: str(form.get('nextActionItem')),
        createdById: memberId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })

    const companyName = str(form.get('companyName'))
    const clientKey = momClientKey(clientName, companyName)
    const pendingSameClient = await prisma.meetingMinute.findMany({
      where: {
        id: { not: record.id },
        clientName,
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
        data: { followUpCompletedAt: meetingDate },
      })
    }

    const notifyIds = attendeeMemberIds.filter(id => id !== memberId)
    if (notifyIds.length) {
      const creatorName = record.createdBy.name
      const companyLabel = companyName ? ` · ${companyName}` : ''
      await notify(
        'mom_attendee',
        notifyIds,
        `${creatorName} added you as an attendee on a MOM: ${clientName}${companyLabel} (${meetingType})`,
        `/mom/${record.id}`
      )
    }

    const campaignCallId = str(form.get('campaignCallId'))
    if (campaignCallId) {
      await prisma.campaignCall.updateMany({
        where: { id: campaignCallId, momId: null },
        data: {
          momId: record.id,
          status: 'completed',
          completedAt: meetingDate,
        },
      })
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Your session is out of date. Please sign out and sign in again.' },
        { status: 401 }
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to create MOM'
    logger.error('Failed to create meeting minute', error as Error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
