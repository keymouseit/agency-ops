import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()
  const analysis = await prisma.lossAnalysis.upsert({
    where: { leadId: params.id },
    update: {
      reason: data.reason, faultArea: data.faultArea,
      faultOwnerId: data.faultOwnerId || null,
      notes: data.notes || null, competitorWon: data.competitorWon || null,
      lessonsLearned: data.lessonsLearned || null,
    },
    create: {
      leadId: params.id, reason: data.reason, faultArea: data.faultArea,
      faultOwnerId: data.faultOwnerId || null,
      notes: data.notes || null, competitorWon: data.competitorWon || null,
      lessonsLearned: data.lessonsLearned || null,
    },
  })
  return NextResponse.json(analysis)
}
