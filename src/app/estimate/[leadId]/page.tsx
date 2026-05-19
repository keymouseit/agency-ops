import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import EstimateForm from './EstimateForm'

export const dynamic = 'force-dynamic'

export default async function EstimatePage({ params }: { params: { leadId: string } }) {
  const [lead, members, existingRequest] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: params.leadId },
      include: {
        owner: true,
        estimationRequests: {
          include: {
            assignee: true,
            requester: true,
            record: { include: { lines: { orderBy: { sortOrder: 'asc' } }, estimatedBy: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.estimationRequest.findFirst({
      where: { leadId: params.leadId },
      include: {
        record: { include: { lines: { orderBy: { sortOrder: 'asc' } } } },
        assignee: true,
        requester: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!lead) notFound()

  // Serialize dates for client component
  const serializedRequest = existingRequest ? {
    ...existingRequest,
    createdAt: existingRequest.createdAt.toISOString(),
    updatedAt: existingRequest.updatedAt.toISOString(),
    dueBy: existingRequest.dueBy?.toISOString() || null,
    record: existingRequest.record ? {
      ...existingRequest.record,
      createdAt: existingRequest.record.createdAt.toISOString(),
      updatedAt: existingRequest.record.updatedAt.toISOString(),
      devConfirmedAt: existingRequest.record.devConfirmedAt?.toISOString() || null,
      bdApprovedAt: existingRequest.record.bdApprovedAt?.toISOString() || null,
      lines: existingRequest.record.lines.map(line => ({
        ...line,
        createdAt: line.createdAt.toISOString(),
        updatedAt: line.updatedAt.toISOString(),
      })),
    } : null,
    assignee: {
      ...existingRequest.assignee,
      createdAt: existingRequest.assignee.createdAt.toISOString(),
    },
    requester: {
      ...existingRequest.requester,
      createdAt: existingRequest.requester.createdAt.toISOString(),
    },
  } : null

  return (
    <EstimateForm
      lead={{
        id: lead.id,
        clientName: lead.clientName,
        description: lead.description,
        budget: lead.budget,
        currency: lead.currency,
        source: lead.source,
        owner: lead.owner,
      }}
      members={members}
      existingRequest={serializedRequest}
    />
  )
}
