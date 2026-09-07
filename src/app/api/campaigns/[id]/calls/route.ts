import { NextResponse } from 'next/server'
import { checkRole, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  validateEmailOrPhone,
  validateLinkedInUrl,
  validateScheduledDateTime,
} from '@/lib/validation'

const ROLES = ['BD', 'Both', 'Founder', 'Manager'] as const

function str(v: unknown) {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t || null
}

function parseDate(v: unknown) {
  if (!v || typeof v !== 'string' || !v.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const { memberId } = await requireRole([...ROLES])
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  const body = await req.json()
  const clientName = str(body.clientName)
  const scheduledDate = parseDate(body.scheduledDate)
  const scheduledTime = str(body.scheduledTime)
  const clientEmail = str(body.clientEmail)
  const clientPhone = str(body.clientPhone)
  const clientLinkedIn = str(body.clientLinkedIn)

  if (!clientName) {
    return NextResponse.json({ error: 'Client name is required.' }, { status: 400 })
  }

  const dateTimeError = validateScheduledDateTime(body.scheduledDate, body.scheduledTime)
  if (dateTimeError) {
    return NextResponse.json({ error: dateTimeError }, { status: 400 })
  }
  if (!scheduledDate) {
    return NextResponse.json({ error: 'Scheduled date is required.' }, { status: 400 })
  }

  const contactError = validateEmailOrPhone(clientEmail, clientPhone)
  if (contactError) {
    return NextResponse.json({ error: contactError }, { status: 400 })
  }

  const linkedInError = validateLinkedInUrl(clientLinkedIn)
  if (linkedInError) {
    return NextResponse.json({ error: linkedInError }, { status: 400 })
  }

  const call = await prisma.campaignCall.create({
    data: {
      campaignId: params.id,
      clientName,
      companyName: str(body.companyName),
      clientLinkedIn,
      clientEmail,
      clientPhone,
      scheduledDate,
      scheduledTime,
      notes: str(body.notes),
      createdById: memberId,
    },
    include: { createdBy: { select: { name: true } } },
  })

  return NextResponse.json(call, { status: 201 })
}
