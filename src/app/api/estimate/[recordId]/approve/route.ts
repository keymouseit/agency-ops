import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_req: Request, { params }: { params: { recordId: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const record = await prisma.estimationRecord.update({
    where: { id: params.recordId },
    data: { bdApprovedAt: new Date() },
  })
  await prisma.estimationRequest.update({
    where: { id: record.requestId },
    data: { status: 'approved' },
  })
  // Notify the dev estimator their work was approved
  const req = await prisma.estimationRequest.findUnique({
    where: { id: record.requestId },
    include: { lead: { select: { clientName: true } } },
  })
  if (req) {
    await notify('estimate_approved', [req.assignedTo],
      `Your estimate for ${req.lead.clientName} was approved by BD`,
      `/estimate/${req.leadId}`)
  }

  return NextResponse.json(record)
}
