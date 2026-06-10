import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Dev', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const ci = await prisma.projectCheckIn.create({
    data: {
      projectId: params.id,
      submittedById: data.submittedById,
      weekOf: startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday = start of week
      progressPct: parseInt(data.progressPct),
      onTrack: data.onTrack || 'yes',
      scopeChange: data.scopeChange || 'none',
      clientUpdated: data.clientUpdated === 'true' || data.clientUpdated === true,
      blockers: data.blockers || null,
      estimateDrift: data.estimateDrift ? parseFloat(data.estimateDrift) : null,
      notes: data.notes || null,
    },
  })
  return NextResponse.json(ci)
}
