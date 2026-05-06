import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const project = await prisma.project.create({
    data: {
      name: data.name,
      leadId: data.leadId || null,
      ownerId: data.ownerId,
      clientName: data.clientName || null,
      contractValue: data.contractValue ? parseFloat(data.contractValue) : null,
      currency: data.currency || 'USD',
      estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
      techStack: data.techStack || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      estimatedEnd: data.estimatedEnd ? new Date(data.estimatedEnd) : null,
    },
  })
  return NextResponse.json(project)
}
