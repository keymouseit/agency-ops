import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ROLES = ['Founder', 'Manager', 'BD', 'Both'] as const

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  let body: { followUpCompleted?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (body.followUpCompleted !== true) {
    return NextResponse.json({ error: 'Invalid update.' }, { status: 400 })
  }

  const existing = await prisma.salesRobotProspect.findUnique({
    where: { id: params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 })
  }
  if (!existing.isReplied) {
    return NextResponse.json(
      { error: 'Only replied prospects can be marked done.' },
      { status: 400 }
    )
  }

  const record = await prisma.salesRobotProspect.update({
    where: { id: params.id },
    data: { followUpCompletedAt: new Date() },
  })

  revalidatePath('/salesrobot')

  return NextResponse.json({
    id: record.id,
    followUpCompletedAt: record.followUpCompletedAt,
  })
}
