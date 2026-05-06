import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const blocker = await prisma.blocker.update({
    where: { id: params.id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.status === 'resolved' && { resolvedAt: new Date() }),
      ...(data.status === 'escalated' && { escalatedToFounder: true }),
      ...(data.founderNote && { founderNote: data.founderNote }),
    },
  })
  // If escalated, notify founder(s)
  if (data.status === 'escalated') {
    const founders = await prisma.teamMember.findMany({ where: { role: 'Founder', active: true }, select: { id: true } })
    const b = await prisma.blocker.findUnique({ where: { id: params.id }, include: { member: { select: { name: true } }, project: { select: { name: true } } } })
    if (b && founders.length) {
      const projectPart = b.project ? ` on ${b.project.name}` : ''
      await notify('blocker_escalated', founders.map(f => f.id),
        `${b.member.name}'s blocker${projectPart} was escalated: ${b.description.slice(0, 80)}`,
        '/intelligence')
    }
  }

  return NextResponse.json(blocker)
}
