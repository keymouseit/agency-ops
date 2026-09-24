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



/** Keep the auto-linked test case aligned with bug status so Dev/QA never see Fail + Fixed together. */
export async function syncLinkedTestCaseWithBugStatus(params: {
  testCaseId: string | null | undefined
  bugStatus: string
  resolutionNotes?: string | null
}) {
  if (!params.testCaseId) return null

  let status: string | null = null
  let notes: string | null | undefined

  if (params.bugStatus === 'open') {
    status = 'fail'
  } else if (params.bugStatus === 'fixed') {
    // Dev sent fix back — clear Fail so the case waits for QA re-test
    status = 'pending'
    const fixNote = params.resolutionNotes?.trim()
    notes = fixNote
      ? `Dev fixed — awaiting QA re-test. ${fixNote}`
      : 'Dev fixed — awaiting QA re-test'
  } else if (params.bugStatus === 'closed') {
    status = 'pass'
  } else if (params.bugStatus === 'wont_fix') {
    status = 'skipped'
  } else {
    return null
  }

  const data: { status: string; notes?: string | null; testedAt?: Date | null; testedById?: string | null } = {
    status,
  }
  if (notes !== undefined) data.notes = notes
  if (status === 'pending') {
    data.testedAt = null
    data.testedById = null
  }

  return prisma.milestoneTestCase.update({
    where: { id: params.testCaseId },
    data,
  })
}

/** When QA fails a passed case or reopens a bug on an approved milestone, send it back to In progress. */
export async function revertQaApprovedMilestoneToInProgress(params: {
  milestoneId: string
  currentStatus: string
  projectId: string
  projectName: string
  milestoneTitle: string
  reason: string
  request?: Request
}): Promise<'in_progress' | null> {
  if (params.currentStatus !== 'done') return null

  const { logProjectQAActivity } = await import('@/lib/qa-audit')
  const { invalidateProjectCaches } = await import('@/lib/cache-tags')

  await prisma.milestone.update({
    where: { id: params.milestoneId },
    data: {
      status: 'in_progress',
      completedAt: null,
      qaStartedAt: null,
      qaStartedById: null,
    },
  })

  await logProjectQAActivity(
    'status_changed',
    params.projectId,
    params.projectName,
    {
      qaEventType: 'milestone_status_changed',
      milestoneId: params.milestoneId,
      milestoneTitle: params.milestoneTitle,
      fromStatus: 'done',
      toStatus: 'in_progress',
      reason: params.reason,
    },
    params.request,
  )

  invalidateProjectCaches(params.projectId)
  return 'in_progress'
}

export function isValidBugSeverity(value: string) {
  return BUG_SEVERITIES.includes(value as typeof BUG_SEVERITIES[number])
}

export function isValidBugStatus(value: string) {
  return BUG_STATUSES.includes(value as typeof BUG_STATUSES[number])
}
