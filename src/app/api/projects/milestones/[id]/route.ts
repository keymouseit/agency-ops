import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()

  const milestone = await prisma.milestone.update({
    where: { id: params.id },
    data: {
      status: data.status,
      completedAt: data.status === 'done' ? new Date() : null,
    },
  })

  return NextResponse.json(milestone)
}
