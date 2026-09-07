import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { serializeTestCycleCase } from '@/lib/project-queries'
import { deriveCycleResultFromCases, isBlockingCycleResult, testCycleCaseSummary } from '@/lib/qa'
import { logProjectQAActivity } from '@/lib/qa-audit'

const VALID_STATUSES = ['pass', 'fail', 'blocked', 'skipped']

async function loadCase(caseId: string) {
  return prisma.testCycleCase.findUnique({
    where: { id: caseId },
    include: {
      devFixedBy: { select: { name: true } },
      qaRetestedBy: { select: { name: true } },
      testCycle: {
        include: {
          signOff: true,
          project: { select: { id: true, name: true, developerId: true } },
          cases: true,
        },
      },
    },
  })
}

async function assertLatestCycle(existing: NonNullable<Awaited<ReturnType<typeof loadCase>>>) {
  const latestCycle = await prisma.testCycle.findFirst({
    where: { projectId: existing.testCycle.project.id },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  })

  if (!latestCycle || latestCycle.id !== existing.testCycleId) {
    return NextResponse.json({ error: 'Updates are only allowed on the latest test cycle' }, { status: 400 })
  }

  if (existing.testCycle.signOff) {
    return NextResponse.json({ error: 'This test cycle is already signed off' }, { status: 400 })
  }

  return null
}

async function syncCycleResult(cycleId: string, previousResult: string) {
  const cases = await prisma.testCycleCase.findMany({ where: { testCycleId: cycleId } })
  const newResult = deriveCycleResultFromCases(cases, previousResult)
  await prisma.testCycle.update({
    where: { id: cycleId },
    data: {
      result: newResult,
      ...(isBlockingCycleResult(newResult) || newResult === 'conditional' ? {} : { blockerNote: null }),
    },
  })
  return { newResult, cases }
}

export async function PATCH(req: Request, { params }: { params: { caseId: string } }) {
  const data = await req.json()
  const action = data.action === 'qa_retest' ? 'qa_retest' : 'dev_fix'

  if (action === 'qa_retest') {
    return handleQARetest(req, params.caseId, data)
  }
  return handleDevFix(params.caseId, data)
}

async function handleDevFix(caseId: string, data: { fixNotes?: string }) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fixNotes = typeof data.fixNotes === 'string' ? data.fixNotes.trim() : ''
  if (!fixNotes) {
    return NextResponse.json({ error: 'Please describe what you fixed' }, { status: 400 })
  }

  const existing = await loadCase(caseId)
  if (!existing) {
    return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
  }

  const project = existing.testCycle.project
  if (project.developerId !== userId && session?.user?.role !== 'Founder') {
    return NextResponse.json({ error: 'Only the project developer can mark fixes' }, { status: 403 })
  }

  if (!['fail', 'blocked'].includes(existing.status)) {
    return NextResponse.json({ error: 'Only failed or blocked test cases can be marked as fixed' }, { status: 400 })
  }

  const cycleDeny = await assertLatestCycle(existing)
  if (cycleDeny) return cycleDeny

  const updated = await prisma.testCycleCase.update({
    where: { id: caseId },
    data: {
      devFixedAt: new Date(),
      devFixNotes: fixNotes,
      devFixedById: userId,
      qaRetestedAt: null,
      qaRetestNotes: null,
      qaRetestedById: null,
    },
    include: {
      devFixedBy: { select: { name: true } },
      qaRetestedBy: { select: { name: true } },
    },
  })

  const allCases = existing.testCycle.cases.map(c =>
    c.id === updated.id
      ? { status: c.status, devFixedAt: updated.devFixedAt }
      : { status: c.status, devFixedAt: c.devFixedAt },
  )
  const summary = testCycleCaseSummary(allCases)

  if (summary.allFailuresFixed) {
    const qaMembers = await prisma.teamMember.findMany({
      where: { role: { in: ['QA', 'Both'] }, active: true },
      select: { id: true },
    })
    if (qaMembers.length) {
      await notify(
        'test_cycle_fix_ready',
        qaMembers.map(m => m.id),
        `${project.name}: all test failures fixed — ready for re-test`,
        `/qa/${project.id}`,
      )
    }
  }

  await logProjectQAActivity(
    'updated',
    project.id,
    project.name,
    {
      qaEventType: 'test_cycle_case_dev_fix',
      caseId: updated.id,
      caseTitle: updated.title,
      cycleId: existing.testCycleId,
      fixNotes,
    },
  )

  return NextResponse.json(serializeTestCycleCase(updated))
}

async function handleQARetest(
  _req: Request,
  caseId: string,
  data: { status?: string; retestNotes?: string },
) {
  const deny = await checkRole(['QA', 'Both', 'Founder'])
  if (deny) return deny

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = typeof data.status === 'string' ? data.status : ''
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid test result' }, { status: 400 })
  }

  const retestNotes = typeof data.retestNotes === 'string' ? data.retestNotes.trim() : ''

  const existing = await loadCase(caseId)
  if (!existing) {
    return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
  }

  if (!existing.devFixedAt) {
    return NextResponse.json({ error: 'Developer has not submitted a fix for this case yet' }, { status: 400 })
  }

  const cycleDeny = await assertLatestCycle(existing)
  if (cycleDeny) return cycleDeny

  const project = existing.testCycle.project
  const isReopen = status === 'fail' || status === 'blocked'

  if (isReopen && !retestNotes) {
    return NextResponse.json({ error: 'Please describe what is still failing' }, { status: 400 })
  }

  const updated = await prisma.testCycleCase.update({
    where: { id: caseId },
    data: isReopen
      ? {
          status,
          devFixedAt: null,
          devFixNotes: null,
          devFixedById: null,
          qaRetestedAt: new Date(),
          qaRetestNotes: retestNotes,
          qaRetestedById: userId,
        }
      : {
          status,
          qaRetestedAt: new Date(),
          qaRetestNotes: retestNotes || null,
          qaRetestedById: userId,
        },
    include: {
      devFixedBy: { select: { name: true } },
      qaRetestedBy: { select: { name: true } },
    },
  })

  const { newResult } = await syncCycleResult(existing.testCycleId, existing.testCycle.result)

  if (isReopen) {
    await notify(
      'test_cycle_fail',
      [project.developerId],
      `QA: ${project.name} — "${existing.title}" still failing after your fix`,
      `/projects/${project.id}#qa`,
    )
  } else if (newResult === 'pass' || newResult === 'conditional') {
    await notify(
      'test_cycle_pass',
      [project.developerId],
      `QA: ${project.name} test cycle ${newResult === 'conditional' ? 'conditional pass' : 'pass'} — all cases verified`,
      `/projects/${project.id}#qa`,
    )
  }

  await logProjectQAActivity(
    'updated',
    project.id,
    project.name,
    {
      qaEventType: 'test_cycle_case_retest',
      caseId: updated.id,
      caseTitle: existing.title,
      cycleId: existing.testCycleId,
      status,
      cycleResult: newResult,
      retestNotes: retestNotes || null,
    },
  )

  return NextResponse.json({
    ...serializeTestCycleCase(updated),
    cycleResult: newResult,
  })
}
