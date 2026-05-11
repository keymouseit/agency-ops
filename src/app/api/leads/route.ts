import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()
  const lead = await prisma.lead.create({
    data: {
      clientName: data.clientName,
      source: data.source,
      description: data.description || null,
      budget: data.budget ? parseFloat(data.budget) : null,
      currency: data.currency || 'USD',
      ownerId: data.ownerId,
    },
  })
  return NextResponse.json(lead)
}
