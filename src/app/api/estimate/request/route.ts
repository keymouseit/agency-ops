import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()
  const request = await prisma.estimationRequest.create({
    data: {
      leadId: data.leadId,
      requestedBy: data.requestedBy,
      assignedTo: data.assignedTo,
      notes: data.notes || null,
      dueBy: data.dueBy ? new Date(data.dueBy) : null,
      status: 'pending',
    },
  })
  // Notify the assigned developer
  const requester = await prisma.teamMember.findUnique({ where: { id: data.requestedBy }, select: { name: true } })
  const lead = await prisma.lead.findUnique({ where: { id: data.leadId }, select: { clientName: true } })
  if (data.assignedTo && requester && lead) {
    await notify('estimate_requested', [data.assignedTo],
      `${requester.name} has requested an estimate for ${lead.clientName}`,
      `/estimate/${data.leadId}`)
  }

  return NextResponse.json(request)
}
