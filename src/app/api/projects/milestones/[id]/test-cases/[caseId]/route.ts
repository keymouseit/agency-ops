import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { TEST_CASE_STATUSES } from '@/lib/milestone-qa'
import { upsertBugForFailedTestCase } from '@/lib/milestone-bugs'
import { logProjectQAActivity } from '@/lib/qa-audit'

export async function PATCH(req: Request, { params }: { params: { id: string; caseId: string } }) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const data = await req.json()

  const existing = await prisma.milestoneTestCase.findUnique({
    where: { id: params.caseId },
    include: {
      milestone: {
        include: { project: { select: { id: true, name: true, developerId: true } } },
      },
    },
  })

  if (!existing || existing.milestoneId !== params.id) {
    return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
  }

  if (!['testing', 'done', 'ready_for_qa'].includes(existing.milestone.status)) {
    return NextResponse.json({ error: 'Milestone is not in testing' }, { status: 400 })
  }

  const session = await (await import('@/lib/auth')).auth()
  const update: {
    title?: string
    status?: string
    notes?: string | null
    testedById?: string
    testedAt?: Date | null
  } = {}

  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    update.title = title
  }

  if (typeof data.status === 'string') {
    if (!TEST_CASE_STATUSES.includes(data.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = data.status
    if (data.status !== 'pending') {
      update.testedById = session?.user?.id
      update.testedAt = new Date()
    } else {
      update.testedById = undefined
      update.testedAt = null
    }
  }

  if (data.notes !== undefined) {
    update.notes = typeof data.notes === 'string' ? data.notes.trim() || null : null
  }

  const testCase = await prisma.milestoneTestCase.update({
    where: { id: params.caseId },
    data: update,
    include: { testedBy: { select: { name: true } } },
  })

  if (data.status && session?.user?.id) {
    const bug = await upsertBugForFailedTestCase({
      milestoneId: params.id,
      testCaseId: params.caseId,
      title: testCase.title,
      notes: testCase.notes,
      status: testCase.status,
      reportedById: session.user.id,
    })

    if (bug && (data.status === 'fail' || data.status === 'blocked')) {
      await notify(
        'milestone_bug_logged',
        [existing.milestone.project.developerId],
        `Bug logged: ${bug.title} (${existing.milestone.title})`,
        `/projects/${existing.milestone.project.id}#qa`
      )
    }

    await logProjectQAActivity(
      'updated',
      existing.milestone.project.id,
      existing.milestone.project.name,
      {
        qaEventType: 'milestone_test_case_updated',
        milestoneId: existing.milestone.id,
        milestoneTitle: existing.milestone.title,
        caseId: testCase.id,
        caseTitle: testCase.title,
        status: testCase.status,
      },
      req,
    )
  }

  return NextResponse.json({
    id: testCase.id,
    title: testCase.title,
    status: testCase.status,
    notes: testCase.notes,
    testedAt: testCase.testedAt?.toISOString() ?? null,
    testedBy: testCase.testedBy ? { name: testCase.testedBy.name } : null,
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string; caseId: string } }) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const existing = await prisma.milestoneTestCase.findUnique({
    where: { id: params.caseId },
    select: { milestoneId: true, milestone: { select: { status: true } } },
  })

  if (!existing || existing.milestoneId !== params.id) {
    return NextResponse.json({ error: 'Test case not found' }, { status: 404 })
  }

  if (existing.milestone.status === 'done') {
    return NextResponse.json({ error: 'Cannot delete test cases on approved milestones' }, { status: 400 })
  }

  await prisma.milestoneTestCase.delete({ where: { id: params.caseId } })
  return NextResponse.json({ ok: true })
}
