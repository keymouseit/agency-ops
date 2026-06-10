import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  const project = await prisma.project.findUnique({
    where: { id: params.id },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  if (!['qa', 'delivered'].includes(project.status)) {
    return NextResponse.json(
      { error: 'Post-mortem can only be added when project is in QA or delivered status.' },
      { status: 403 }
    )
  }

  const data = await req.json()
  const pm = await prisma.postMortem.upsert({
    where: { projectId: params.id },
    update: {
      estimationAccuracy: data.estimationAccuracy ? parseFloat(data.estimationAccuracy) : null,
      clientSatisfaction: data.clientSatisfaction ? parseInt(data.clientSatisfaction) : null,
      onTime: data.onTime === 'true',
      whatWorked: data.whatWorked || null,
      whatBroke: data.whatBroke || null,
      rootCause: data.rootCause || null,
      preventionAction: data.preventionAction || null,
    },
    create: {
      projectId: params.id,
      estimationAccuracy: data.estimationAccuracy ? parseFloat(data.estimationAccuracy) : null,
      clientSatisfaction: data.clientSatisfaction ? parseInt(data.clientSatisfaction) : null,
      onTime: data.onTime === 'true',
      whatWorked: data.whatWorked || null,
      whatBroke: data.whatBroke || null,
      rootCause: data.rootCause || null,
      preventionAction: data.preventionAction || null,
    },
  })
  return NextResponse.json(pm)
}
