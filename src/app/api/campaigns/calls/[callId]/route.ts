import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CALL_STATUSES } from '@/lib/campaigns'

const ROLES = ['BD', 'Both', 'Founder', 'Manager'] as const

export async function PATCH(
  req: Request,
  { params }: { params: { callId: string } }
) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const body = await req.json()
  const call = await prisma.campaignCall.findUnique({
    where: { id: params.callId },
    include: { campaign: true },
  })

  if (!call) {
    return NextResponse.json({ error: 'Call not found.' }, { status: 404 })
  }

  const data: {
    status?: string
    completedAt?: Date | null
    momId?: string | null
  } = {}

  if (body.status) {
    if (!CALL_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
    }
    data.status = body.status
    if (body.status === 'completed') {
      data.completedAt = new Date()
    }
    if (body.status === 'scheduled') {
      data.completedAt = null
    }
  }

  if (body.momId !== undefined) {
    data.momId = body.momId || null
    if (body.momId) {
      data.status = 'completed'
      data.completedAt = new Date()
    }
  }

  const updated = await prisma.campaignCall.update({
    where: { id: params.callId },
    data,
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
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${call.campaignId}`)

  return NextResponse.json(updated)
}
