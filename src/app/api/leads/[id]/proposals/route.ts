import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const proposal = await prisma.proposal.create({
    data: {
      leadId: params.id,
      writtenById: data.writtenById,
      budgetQuoted: data.budgetQuoted ? parseFloat(data.budgetQuoted) : null,
      techStack: data.techStack || null,
      connectsSpent: data.connectsSpent ? parseInt(data.connectsSpent) : null,
      status: data.status || 'sent',
      interviewNotes: data.interviewNotes || null,
    },
  })
  return NextResponse.json(proposal)
}
