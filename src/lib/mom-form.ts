import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { MOM_MEETING_TYPES } from '@/lib/utils'

export function parseMomDate(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function momFormStr(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function saveMeetingVideo(file: File | null) {
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

export async function resolveMomAttendees(form: FormData) {
  const ids = form.getAll('attendeeIds').filter((v): v is string => typeof v === 'string' && v.trim() !== '')

  let custom: { name: string; role: string }[] = []
  const customRaw = momFormStr(form.get('customAttendees'))
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

export type ParsedMomFields = {
  clientName: string
  meetingType: string
  meetingDate: Date
  meetingTime: string | null
  clientLinkedIn: string | null
  companyName: string | null
  companyLinkedIn: string | null
  clientEmail: string | null
  clientPhone: string | null
  meetingOutcome: string | null
  attendees: string | null
  attendeeMemberIds: string[]
  domain: string | null
  clientPainPoints: string | null
  ourApproach: string | null
  requirementsFromClient: string | null
  followUpDate: Date | null
  meetingVideoPath: string | null
  meetingVideoUrl: string | null
  leadSource: string | null
  nextActionItem: string | null
  campaignCallId: string | null
}

/** Parse and validate MOM create/update form body. */
export async function parseMomFormFields(
  form: FormData,
  opts?: { keepExistingVideoPath?: string | null }
): Promise<ParsedMomFields> {
  const clientName = momFormStr(form.get('clientName'))
  const meetingType = momFormStr(form.get('meetingType'))
  const meetingDate = parseMomDate(form.get('meetingDate'))

  if (!clientName) throw Object.assign(new Error('Client name is required.'), { status: 400 })
  if (!meetingDate) throw Object.assign(new Error('Meeting date is required.'), { status: 400 })
  if (!meetingType || !MOM_MEETING_TYPES.includes(meetingType as (typeof MOM_MEETING_TYPES)[number])) {
    throw Object.assign(new Error('Valid meeting type is required.'), { status: 400 })
  }

  const videoFile = form.get('meetingVideo')
  const uploadedPath =
    videoFile instanceof File && videoFile.size > 0 ? await saveMeetingVideo(videoFile) : null
  const { json: attendees, memberIds: attendeeMemberIds } = await resolveMomAttendees(form)

  return {
    clientName,
    meetingType,
    meetingDate,
    meetingTime: momFormStr(form.get('meetingTime')),
    clientLinkedIn: momFormStr(form.get('clientLinkedIn')),
    companyName: momFormStr(form.get('companyName')),
    companyLinkedIn: momFormStr(form.get('companyLinkedIn')),
    clientEmail: momFormStr(form.get('clientEmail')),
    clientPhone: momFormStr(form.get('clientPhone')),
    meetingOutcome: momFormStr(form.get('meetingOutcome')),
    attendees,
    attendeeMemberIds,
    domain: momFormStr(form.get('domain')),
    clientPainPoints: momFormStr(form.get('clientPainPoints')),
    ourApproach: momFormStr(form.get('ourApproach')),
    requirementsFromClient: momFormStr(form.get('requirementsFromClient')),
    followUpDate: parseMomDate(form.get('followUpDate')),
    meetingVideoPath: uploadedPath ?? opts?.keepExistingVideoPath ?? null,
    meetingVideoUrl: momFormStr(form.get('meetingVideoUrl')),
    leadSource: momFormStr(form.get('leadSource')),
    nextActionItem: momFormStr(form.get('nextActionItem')),
    campaignCallId: momFormStr(form.get('campaignCallId')),
  }
}

export function momFieldsToPrismaData(fields: ParsedMomFields, extra?: Record<string, unknown>) {
  return {
    meetingDate: fields.meetingDate,
    meetingTime: fields.meetingTime,
    clientName: fields.clientName,
    clientLinkedIn: fields.clientLinkedIn,
    companyName: fields.companyName,
    companyLinkedIn: fields.companyLinkedIn,
    clientEmail: fields.clientEmail,
    clientPhone: fields.clientPhone,
    meetingType: fields.meetingType,
    meetingOutcome: fields.meetingOutcome,
    attendees: fields.attendees,
    domain: fields.domain,
    clientPainPoints: fields.clientPainPoints,
    ourApproach: fields.ourApproach,
    requirementsFromClient: fields.requirementsFromClient,
    followUpDate: fields.followUpDate,
    meetingVideoPath: fields.meetingVideoPath,
    meetingVideoUrl: fields.meetingVideoUrl,
    leadSource: fields.leadSource,
    nextActionItem: fields.nextActionItem,
    ...extra,
  }
}

export type MomAttendee = { name: string; role: string }

export function parseMomAttendeesJson(raw: string | null): MomAttendee[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((a): a is MomAttendee =>
        !!a && typeof a === 'object' && typeof (a as MomAttendee).name === 'string' && !!(a as MomAttendee).name.trim()
      )
      .map(a => ({ name: a.name.trim(), role: (a.role?.trim() || 'Guest') }))
  } catch {
    return []
  }
}

/** Split stored attendees into team member ids + custom guests. */
export function splitMomAttendees(
  attendees: MomAttendee[],
  members: { id: string; name: string }[],
): { memberIds: string[]; customAttendees: MomAttendee[] } {
  const byName = new Map(members.map(m => [m.name.trim().toLowerCase(), m.id]))
  const memberIds: string[] = []
  const customAttendees: MomAttendee[] = []
  const seen = new Set<string>()

  for (const a of attendees) {
    const key = a.name.trim().toLowerCase()
    const memberId = byName.get(key)
    if (memberId) {
      if (!seen.has(memberId)) {
        memberIds.push(memberId)
        seen.add(memberId)
      }
    } else {
      customAttendees.push(a)
    }
  }

  return { memberIds, customAttendees }
}
