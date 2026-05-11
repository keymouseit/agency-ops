import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request, { params }: { params: { recordId: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const { note } = await request.json()
  const record = await prisma.estimationRecord.update({
    where: { id: params.recordId },
    data: { bdRevisionNote: note, devConfirmedAt: null },
  })
  await prisma.estimationRequest.update({
    where: { id: record.requestId },
    data: { status: 'revision' },
  })

  // Notify the dev estimator
  const estReq = await prisma.estimationRequest.findUnique({
    where: { id: record.requestId },
    include: { lead: { select: { clientName: true } } },
  })
  if (estReq) {
    await notify(
      'estimate_revision',
      [estReq.assignedTo],
      `BD sent your estimate for ${estReq.lead.clientName} back for revision: ${note.slice(0, 80)}`,
      `/estimate/${estReq.leadId}`
    )
  }

  return NextResponse.json(record)
}
