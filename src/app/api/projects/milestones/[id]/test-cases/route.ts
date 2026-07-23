import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { logProjectQAActivity } from '@/lib/qa-audit'

async function getMilestoneWithAccess(milestoneId: string, writeAccess = false) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      project: { select: { id: true, name: true, developerId: true } },
      testCases: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { testedBy: { select: { name: true } } },
      },
    },
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

function serializeTestCases(testCases: Array<{
  id: string
  title: string
  status: string
  notes: string | null
  testedAt: Date | null
  testedBy: { name: string } | null
}>) {
  return testCases.map(tc => ({
    id: tc.id,
    title: tc.title,
    status: tc.status,
    notes: tc.notes,
    testedAt: tc.testedAt?.toISOString() ?? null,
    testedBy: tc.testedBy ? { name: tc.testedBy.name } : null,
  }))
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const result = await getMilestoneWithAccess(params.id)
  if ('error' in result && result.error) return result.error

  return NextResponse.json({
    milestone: {
      id: result.milestone!.id,
      status: result.milestone!.status,
      qaStartedAt: result.milestone!.qaStartedAt?.toISOString() ?? null,
    },
    testCases: serializeTestCases(result.milestone!.testCases),
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const result = await getMilestoneWithAccess(params.id, true)
  if ('error' in result && result.error) return result.error

  const { milestone, session } = result
  const data = await req.json()
  const title = typeof data.title === 'string' ? data.title.trim() : ''

  if (!title) {
    return NextResponse.json({ error: 'Test case title is required' }, { status: 400 })
  }

  if (!['ready_for_qa', 'testing', 'done'].includes(milestone!.status)) {
    return NextResponse.json({ error: 'Milestone is not available for testing' }, { status: 400 })
  }

  const sortOrder = milestone!.testCases.length

  const [testCase] = await prisma.$transaction([
    prisma.milestoneTestCase.create({
      data: {
        milestoneId: params.id,
        title,
        sortOrder,
      },
      include: { testedBy: { select: { name: true } } },
    }),
    ...(milestone!.status === 'ready_for_qa'
      ? [
          prisma.milestone.update({
            where: { id: params.id },
            data: {
              status: 'testing',
              qaStartedAt: new Date(),
              qaStartedById: session!.user!.id,
            },
          }),
        ]
      : []),
  ])

  if (milestone!.status === 'ready_for_qa') {
    await notify(
      'milestone_testing_started',
      [milestone!.project.developerId],
      `QA started testing milestone: ${milestone!.title} in ${milestone!.project.name}`,
      `/projects/${milestone!.project.id}#qa`
    )
    await logProjectQAActivity(
      'updated',
      milestone!.project.id,
      milestone!.project.name,
      {
        qaEventType: 'milestone_testing_started',
        milestoneId: milestone!.id,
        milestoneTitle: milestone!.title,
      },
      req,
    )
  }

  await logProjectQAActivity(
    'created',
    milestone!.project.id,
    milestone!.project.name,
    {
      qaEventType: 'milestone_test_case_added',
      milestoneId: milestone!.id,
      milestoneTitle: milestone!.title,
      caseId: testCase.id,
      caseTitle: testCase.title,
    },
    req,
  )

  return NextResponse.json(serializeTestCases([testCase])[0], { status: 201 })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const data = await req.json()

  if (data.action === 'start_testing') {
    const result = await getMilestoneWithAccess(params.id, true)
    if ('error' in result && result.error) return result.error

    const { milestone, session } = result
    if (milestone!.status !== 'ready_for_qa') {
      return NextResponse.json({ error: 'Milestone is not ready for QA' }, { status: 400 })
    }

    const updated = await prisma.milestone.update({
      where: { id: params.id },
      data: {
        status: 'testing',
        qaStartedAt: new Date(),
        qaStartedById: session!.user!.id,
      },
    })

    await notify(
      'milestone_testing_started',
      [milestone!.project.developerId],
      `QA started testing milestone: ${milestone!.title} in ${milestone!.project.name}`,
      `/projects/${milestone!.project.id}#qa`
    )

    await logProjectQAActivity(
      'updated',
      milestone!.project.id,
      milestone!.project.name,
      {
        qaEventType: 'milestone_testing_started',
        milestoneId: milestone!.id,
        milestoneTitle: milestone!.title,
      },
      req,
    )

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
