import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'
import { invalidateProjectCaches } from '@/lib/cache-tags'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Dev', 'QA', 'Both', 'Founder', 'Manager', 'SocialMedia'])
  if (deny) return deny

  const data = await req.json()
  const weekOf = startOfWeek(new Date(), { weekStartsOn: 1 })

  const existing = await prisma.projectCheckIn.findFirst({
    where: {
      projectId: params.id,
      submittedById: data.submittedById,
      weekOf,
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'You already submitted a project check-in for this week.' },
      { status: 409 }
    )
  }

  const ci = await prisma.projectCheckIn.create({
    data: {
      projectId: params.id,
      submittedById: data.submittedById,
      weekOf,
      progressPct: parseInt(data.progressPct),
      onTrack: data.onTrack || 'yes',
      scopeChange: data.scopeChange || 'none',
      clientUpdated: data.clientUpdated === 'true' || data.clientUpdated === true,
      blockers: data.blockers || null,
      estimateDrift: data.estimateDrift ? parseFloat(data.estimateDrift) : null,
      notes: data.notes || null,
    },
  })

  invalidateProjectCaches(params.id)
  return NextResponse.json(ci)
}
