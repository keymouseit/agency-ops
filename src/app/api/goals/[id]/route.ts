import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Founder', 'Dev', 'BD', 'QA', 'Both'])
  if (deny) return deny

  const data = await req.json()
  const goal = await prisma.goal.update({
    where: { id: params.id },
    data: {
      ...(data.progressPct !== undefined && { progressPct: parseInt(data.progressPct) }),
      ...(data.status && { status: data.status }),
      ...(data.title && { title: data.title }),
    },
  })
  return NextResponse.json(goal)
}
