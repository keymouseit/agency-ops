import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CAMPAIGN_STATUSES } from '@/lib/campaigns'

const ROLES = ['BD', 'Both', 'Founder', 'Manager'] as const

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      calls: {
        include: {
          createdBy: { select: { name: true } },
          mom: {
            select: {
              id: true,
              meetingType: true,
              meetingOutcome: true,
              followUpDate: true,
              followUpCompletedAt: true,
            },
          },
        },
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  return NextResponse.json(campaign)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  const body = await req.json()
  const status = typeof body.status === 'string' ? body.status.trim() : ''

  if (!status || !CAMPAIGN_STATUSES.includes(status as typeof CAMPAIGN_STATUSES[number])) {
    return NextResponse.json({ error: 'Invalid campaign status.' }, { status: 400 })
  }

  const updated = await prisma.campaign.update({
    where: { id: params.id },
    data: { status },
    include: { createdBy: { select: { name: true } } },
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${params.id}`)

  return NextResponse.json(updated)
}
