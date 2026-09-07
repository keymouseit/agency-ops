import { NextResponse } from 'next/server'
import { checkRole, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from '@/lib/campaigns'
import { validateCampaignDates, validateCampaignName } from '@/lib/validation'

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

export async function GET() {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const campaigns = await prisma.campaign.findMany({
    include: {
      createdBy: { select: { name: true } },
      calls: {
        include: {
          mom: {
            select: {
              id: true,
              meetingType: true,
              followUpDate: true,
              followUpCompletedAt: true,
            },
          },
        },
      },
      _count: { select: { calls: true } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  })

  return NextResponse.json(campaigns)
}

export async function POST(req: Request) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const { memberId } = await requireRole([...ROLES])
  const body = await req.json()

  const name = str(body.name)
  const nameError = validateCampaignName(name)
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 })
  }

  const dateError = validateCampaignDates(body.startDate, body.endDate)
  if (dateError) {
    return NextResponse.json({ error: dateError }, { status: 400 })
  }

  const objective = str(body.objective)

  const startDate = parseDate(body.startDate)
  const endDate = parseDate(body.endDate)
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start and end dates are required.' }, { status: 400 })
  }

  const channel = str(body.channel) ?? 'LinkedIn'
  if (!CAMPAIGN_CHANNELS.includes(channel as typeof CAMPAIGN_CHANNELS[number])) {
    return NextResponse.json({ error: 'Invalid channel.' }, { status: 400 })
  }

  const status = str(body.status) ?? 'active'
  if (!CAMPAIGN_STATUSES.includes(status as typeof CAMPAIGN_STATUSES[number])) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: name!,
      channel,
      status,
      objective,
      notes: str(body.notes),
      startDate,
      endDate,
      createdById: memberId,
    },
    include: { createdBy: { select: { name: true } } },
  })

  return NextResponse.json(campaign, { status: 201 })
}
