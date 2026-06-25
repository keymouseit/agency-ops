import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
