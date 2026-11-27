import { prisma } from '@/lib/prisma'
import { BUG_SEVERITIES, BUG_STATUSES } from '@/lib/milestone-qa'

export function formatTestCaseDisplayId(caseNumber: number | null | undefined) {
  if (!caseNumber || caseNumber < 1) return null
  return `TC-${String(caseNumber).padStart(3, '0')}`
}

export function formatBugDisplayId(bugNumber: number | null | undefined) {
  if (!bugNumber || bugNumber < 1) return null
  return `BUG-${String(bugNumber).padStart(3, '0')}`
}

/** Atomically allocate the next project-scoped test case display number. */
export async function allocateTestCaseNumber(projectId: string) {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { nextTestCaseNumber: { increment: 1 } },
    select: { nextTestCaseNumber: true },
  })
  return project.nextTestCaseNumber - 1
}

/** Atomically allocate the next project-scoped bug display number. */
export async function allocateBugNumber(projectId: string) {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { nextBugNumber: { increment: 1 } },
    select: { nextBugNumber: true },
  })
  return project.nextBugNumber - 1
}

/**
 * Backfill display numbers for legacy rows (caseNumber/bugNumber = 0).
 * Safe to call repeatedly; only touches unnumbered rows.
 */
export async function backfillQaDisplayNumbers(projectId: string) {
  const [cases, bugs, project] = await Promise.all([
    prisma.milestoneTestCase.findMany({
      where: { milestone: { projectId }, caseNumber: 0 },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.milestoneBug.findMany({
      where: { milestone: { projectId }, bugNumber: 0 },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { nextTestCaseNumber: true, nextBugNumber: true },
    }),
  ])

  if (!project) return
  if (cases.length === 0 && bugs.length === 0) return

  let nextCase = project.nextTestCaseNumber
  let nextBug = project.nextBugNumber

  for (const tc of cases) {
    await prisma.milestoneTestCase.update({
      where: { id: tc.id },
      data: { caseNumber: nextCase },
    })
    nextCase += 1
  }
  for (const bug of bugs) {
    await prisma.milestoneBug.update({
      where: { id: bug.id },
      data: { bugNumber: nextBug },
    })
    nextBug += 1
  }

  if (nextCase !== project.nextTestCaseNumber || nextBug !== project.nextBugNumber) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        nextTestCaseNumber: nextCase,
        nextBugNumber: nextBug,
      },
    })
  }
}

export async function upsertBugForFailedTestCase(params: {
  milestoneId: string
  testCaseId: string
  title: string
  notes: string | null
  status: string
  reportedById: string
  projectId: string
}) {
  const { milestoneId, testCaseId, title, notes, status, reportedById, projectId } = params
  const isFailure = status === 'fail' || status === 'blocked'

  const existing = await prisma.milestoneBug.findFirst({
    where: { testCaseId },
    orderBy: { createdAt: 'asc' },
  })

  if (isFailure) {
    if (existing) {
      return prisma.milestoneBug.update({
        where: { id: existing.id },
        data: {
          title: existing.title || title,
          description: notes ?? existing.description,
          status: 'open',
          resolvedAt: null,
          resolutionNotes: null,
        },
        include: { reportedBy: { select: { name: true } } },
      })
    }

    const bugNumber = await allocateBugNumber(projectId)
    return prisma.milestoneBug.create({
      data: {
        milestoneId,
        testCaseId,
        bugNumber,
        title,
        description: notes,
        stepsToReproduce: notes,
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

/** Parse stored attachment value (single URL or JSON string array) into links. */
export function parseAttachmentUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((u): u is string => typeof u === 'string' && u.trim() !== '')
          .map(u => u.trim())
      }
    } catch {
      // fall through to single-URL handling
    }
  }
  return [trimmed]
}

/** Normalize + pack multiple links into the attachmentUrl column (JSON when >1). */
export function packAttachmentUrls(urls: Array<string | null | undefined>): string | null {
  const cleaned = urls
    .map(u => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
    .map(u => (/^https?:\/\//i.test(u) ? u : `https://${u}`))
  // de-dupe while preserving order
  const unique = [...new Set(cleaned)]
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return JSON.stringify(unique)
}

export function serializeMilestoneBug(bug: {
  id: string
  bugNumber?: number
  title: string
  description: string | null
  stepsToReproduce?: string | null
  attachmentUrl?: string | null
  severity: string
  status: string
  testCaseId: string | null
  createdAt: Date
  resolvedAt: Date | null
  resolutionNotes: string | null
  reportedBy: { name: string }
}) {
  const attachmentUrls = parseAttachmentUrls(bug.attachmentUrl)
  return {
    id: bug.id,
    bugNumber: bug.bugNumber ?? 0,
    displayId: formatBugDisplayId(bug.bugNumber),
    title: bug.title,
    description: bug.description,
    stepsToReproduce: bug.stepsToReproduce ?? null,
    attachmentUrl: attachmentUrls[0] ?? null,
    attachmentUrls,
    severity: bug.severity,
    status: bug.status,
    testCaseId: bug.testCaseId,
    reportedAt: bug.createdAt.toISOString(),
    reportedBy: { name: bug.reportedBy.name },
    resolvedAt: bug.resolvedAt?.toISOString() ?? null,
    resolutionNotes: bug.resolutionNotes,
  }
}

/**
 * Keep linked test case status aligned with bug workflow.
 * With multiple bugs per case: stay failed while any linked bug is open.
 */
export async function syncLinkedTestCaseWithBugStatus(params: {
  testCaseId: string | null | undefined
  bugStatus: string
  resolutionNotes?: string | null
  excludeBugId?: string
}) {
  if (!params.testCaseId) return null

  const openOthers = await prisma.milestoneBug.count({
    where: {
      testCaseId: params.testCaseId,
      status: 'open',
      ...(params.excludeBugId ? { id: { not: params.excludeBugId } } : {}),
    },
  })

  let status: string | null = null
  let notes: string | null | undefined

  if (params.bugStatus === 'open' || openOthers > 0) {
    status = 'fail'
  } else if (params.bugStatus === 'fixed') {
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
