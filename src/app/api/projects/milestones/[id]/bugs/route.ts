import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import {
  allocateBugNumber,
  isValidBugSeverity,
  packAttachmentUrls,
  serializeMilestoneBug,
  syncLinkedTestCaseWithBugStatus,
} from '@/lib/milestone-bugs'

async function getMilestoneWithAccess(milestoneId: string, writeAccess = false) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { project: { select: { id: true, name: true, developerId: true } } },
  })

  if (!milestone) {
    return { error: NextResponse.json({ error: 'Milestone not found' }, { status: 404 }) }
  }

  const role = session.user.role
  const isDev = role === 'Dev' && milestone.project.developerId === session.user.id
  const canRead = ['Founder', 'Manager', 'QA', 'Both', 'BD'].includes(role ?? '') || isDev
  const canWrite = ['QA', 'Founder'].includes(role ?? '')

  if (writeAccess && !canWrite) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  if (!writeAccess && !canRead) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { milestone, session, canWrite }
}

function resolveAttachmentUrls(data: Record<string, unknown>): string | null {
  if (Array.isArray(data.attachmentUrls)) {
    return packAttachmentUrls(data.attachmentUrls as Array<string | null | undefined>)
  }
  if (typeof data.attachmentUrl === 'string') {
    return packAttachmentUrls([data.attachmentUrl])
  }
  return null
}

async function parseBugBody(req: Request) {
  const data = await req.json()
  return {
    title: typeof data.title === 'string' ? data.title.trim() : '',
    description: typeof data.description === 'string' ? data.description.trim() || null : null,
    stepsToReproduce:
      typeof data.stepsToReproduce === 'string' ? data.stepsToReproduce.trim() || null : null,
    severity: typeof data.severity === 'string' ? data.severity : 'medium',
    testCaseId: typeof data.testCaseId === 'string' ? data.testCaseId.trim() || null : null,
    attachmentUrl: resolveAttachmentUrls(data as Record<string, unknown>),
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const result = await getMilestoneWithAccess(params.id)
  if ('error' in result && result.error) return result.error

  const bugs = await prisma.milestoneBug.findMany({
    where: { milestoneId: params.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { reportedBy: { select: { name: true } } },
  })

  return NextResponse.json(bugs.map(serializeMilestoneBug))
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const result = await getMilestoneWithAccess(params.id, true)
  if ('error' in result && result.error) return result.error

  const { milestone, session } = result

  let body: Awaited<ReturnType<typeof parseBugBody>>
  try {
    body = await parseBugBody(req)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid attachment' },
      { status: 400 },
    )
  }

  const { title, description, stepsToReproduce, severity, testCaseId, attachmentUrl } = body

  if (!title) {
    return NextResponse.json({ error: 'Bug title is required' }, { status: 400 })
  }
  if (!testCaseId) {
    return NextResponse.json({ error: 'Select a test case to log this bug under' }, { status: 400 })
  }
  if (!isValidBugSeverity(severity)) {
    return NextResponse.json({ error: 'Invalid severity' }, { status: 400 })
  }
  if (!['testing', 'done', 'ready_for_qa', 'in_progress'].includes(milestone!.status)) {
    return NextResponse.json({ error: 'Milestone is not available for bug logging' }, { status: 400 })
  }

  const testCase = await prisma.milestoneTestCase.findFirst({
    where: { id: testCaseId, milestoneId: params.id },
    select: { id: true },
  })
  if (!testCase) {
    return NextResponse.json({ error: 'Test case not found on this milestone' }, { status: 400 })
  }

  const bugNumber = await allocateBugNumber(milestone!.project.id)

  try {
    const bug = await prisma.milestoneBug.create({
      data: {
        milestoneId: params.id,
        testCaseId,
        bugNumber,
        title,
        description,
        stepsToReproduce,
        attachmentUrl,
        severity,
        reportedById: session!.user!.id,
      },
      include: { reportedBy: { select: { name: true } } },
    })

    await syncLinkedTestCaseWithBugStatus({
      testCaseId,
      bugStatus: 'open',
    })

    await notify(
      'milestone_bug_logged',
      [milestone!.project.developerId],
      `Bug logged: ${title} (${milestone!.title})`,
      `/projects/${milestone!.project.id}#qa`
    )

    return NextResponse.json(serializeMilestoneBug(bug), { status: 201 })
  } catch (error) {
    console.error('Failed to create milestone bug:', error)
    const message = error instanceof Error ? error.message : 'Failed to log bug'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
