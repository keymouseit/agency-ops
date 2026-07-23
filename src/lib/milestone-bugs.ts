import { prisma } from '@/lib/prisma'
import { BUG_SEVERITIES, BUG_STATUSES } from '@/lib/milestone-qa'

export async function upsertBugForFailedTestCase(params: {
  milestoneId: string
  testCaseId: string
  title: string
  notes: string | null
  status: string
  reportedById: string
}) {
  const { milestoneId, testCaseId, title, notes, status, reportedById } = params
  const isFailure = status === 'fail' || status === 'blocked'

  const existing = await prisma.milestoneBug.findUnique({
    where: { testCaseId },
  })

  if (isFailure) {
    if (existing) {
      return prisma.milestoneBug.update({
        where: { id: existing.id },
        data: {
          title,
          description: notes,
          status: 'open',
          resolvedAt: null,
          resolutionNotes: null,
        },
        include: { reportedBy: { select: { name: true } } },
      })
    }

    return prisma.milestoneBug.create({
      data: {
        milestoneId,
        testCaseId,
        title,
        description: notes,
        severity: status === 'blocked' ? 'high' : 'medium',
        status: 'open',
        reportedById,
      },
      include: { reportedBy: { select: { name: true } } },
    })
  }

  if (existing && existing.status === 'open') {
    return prisma.milestoneBug.update({
      where: { id: existing.id },
      data: {
        status: 'fixed',
        resolvedAt: new Date(),
        resolutionNotes: 'Test case passed or was reset',
      },
      include: { reportedBy: { select: { name: true } } },
    })
  }

  return existing
    ? prisma.milestoneBug.findUnique({
        where: { id: existing.id },
        include: { reportedBy: { select: { name: true } } },
      })
    : null
}

export function serializeMilestoneBug(bug: {
  id: string
  title: string
  description: string | null
  severity: string
  status: string
  testCaseId: string | null
  createdAt: Date
  resolvedAt: Date | null
  resolutionNotes: string | null
  reportedBy: { name: string }
}) {
  return {
    id: bug.id,
    title: bug.title,
    description: bug.description,
    severity: bug.severity,
    status: bug.status,
    testCaseId: bug.testCaseId,
    reportedAt: bug.createdAt.toISOString(),
    reportedBy: { name: bug.reportedBy.name },
    resolvedAt: bug.resolvedAt?.toISOString() ?? null,
    resolutionNotes: bug.resolutionNotes,
  }
}

export function isValidBugSeverity(value: string) {
  return BUG_SEVERITIES.includes(value as typeof BUG_SEVERITIES[number])
}

export function isValidBugStatus(value: string) {
  return BUG_STATUSES.includes(value as typeof BUG_STATUSES[number])
}
