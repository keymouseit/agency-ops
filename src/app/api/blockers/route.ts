import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const blocker = await prisma.blocker.create({
    data: {
      memberId: data.memberId,
      projectId: data.projectId || null,
      description: data.description,
      category: data.category || 'other',
      status: 'open',
    },
  })
  return NextResponse.json(blocker)
}

export async function GET() {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const blockers = await prisma.blocker.findMany({
    where: { status: { in: ['open', 'in_progress'] } },
    include: { member: true, project: { select: { name: true } } },
    orderBy: { raisedAt: 'asc' },
  })
  return NextResponse.json(blockers)
}
