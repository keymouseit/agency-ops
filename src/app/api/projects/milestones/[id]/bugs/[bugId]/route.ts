import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { isValidBugSeverity, isValidBugStatus, serializeMilestoneBug } from '@/lib/milestone-bugs'
import { logProjectQAActivity } from '@/lib/qa-audit'

export async function PATCH(req: Request, { params }: { params: { id: string; bugId: string } }) {
  const session = await auth()
  const userRole = session?.user?.role
  const userId = session?.user?.id

  const data = await req.json()
  const isDevFix = userRole && ['Dev', 'Both'].includes(userRole)
    && data.status === 'fixed'
    && Object.keys(data).every(k => ['status', 'resolutionNotes'].includes(k))

  if (isDevFix) {
    const deny = await checkRole(['Dev', 'Both', 'Founder'])
    if (deny) return deny
  } else {
    const deny = await checkRole(['QA', 'Founder'])
    if (deny) return deny
  }

  const existing = await prisma.milestoneBug.findUnique({
    where: { id: params.bugId },
    include: {
      milestone: {
        include: { project: { select: { id: true, name: true, developerId: true } } },
      },
    },
  })

  if (!existing || existing.milestoneId !== params.id) {
    return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
  }

  if (isDevFix) {
    if (existing.milestone.project.developerId !== userId && userRole !== 'Founder') {
      return NextResponse.json({ error: 'Only the project developer can mark bugs as fixed' }, { status: 403 })
    }
    if (existing.status !== 'open') {
      return NextResponse.json({ error: 'Only open bugs can be marked as fixed' }, { status: 400 })
    }
    if (!data.resolutionNotes?.trim()) {
      return NextResponse.json({ error: 'Please describe what you fixed' }, { status: 400 })
    }
  }

  const update: {
    title?: string
    description?: string | null
    severity?: string
    status?: string
    resolvedAt?: Date | null
    resolutionNotes?: string | null
  } = {}

  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    update.title = title
  }

  if (data.description !== undefined) {
    update.description = typeof data.description === 'string' ? data.description.trim() || null : null
  }

  if (typeof data.severity === 'string') {
    if (!isValidBugSeverity(data.severity)) {
      return NextResponse.json({ error: 'Invalid severity' }, { status: 400 })
    }
    update.severity = data.severity
  }

  if (typeof data.status === 'string') {
    if (!isValidBugStatus(data.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = data.status
    if (data.status === 'open') {
      update.resolvedAt = null
    } else if (['fixed', 'closed', 'wont_fix'].includes(data.status)) {
      update.resolvedAt = new Date()
    }
  }

  if (data.resolutionNotes !== undefined) {
    update.resolutionNotes = typeof data.resolutionNotes === 'string'
      ? data.resolutionNotes.trim() || null
      : null
  }

  const bug = await prisma.milestoneBug.update({
    where: { id: params.bugId },
    data: update,
    include: { reportedBy: { select: { name: true } } },
  })

  if (data.status === 'open' && existing.status !== 'open') {
    await notify(
      'milestone_bug_logged',
      [existing.milestone.project.developerId],
      `Bug reopened: ${bug.title} (${existing.milestone.title})`,
      `/projects/${existing.milestone.project.id}#qa`
    )
  }

  if (isDevFix && data.status === 'fixed') {
    const qaMembers = await prisma.teamMember.findMany({
      where: { role: { in: ['QA', 'Both'] }, active: true },
      select: { id: true },
    })
    if (qaMembers.length) {
      await notify(
        'milestone_test_case_failed',
        qaMembers.map(m => m.id),
        `${existing.milestone.project.name}: bug fixed — ${bug.title} (${existing.milestone.title})`,
        `/qa/${existing.milestone.project.id}`,
      )
    }

    await logProjectQAActivity(
      'updated',
      existing.milestone.project.id,
      existing.milestone.project.name,
      {
        qaEventType: 'milestone_bug_fixed',
        milestoneId: existing.milestone.id,
        milestoneTitle: existing.milestone.title,
        bugId: bug.id,
        bugTitle: bug.title,
        resolutionNotes: bug.resolutionNotes,
      },
      req,
    )
  }

  return NextResponse.json(serializeMilestoneBug(bug))
}

export async function DELETE(_req: Request, { params }: { params: { id: string; bugId: string } }) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const existing = await prisma.milestoneBug.findUnique({
    where: { id: params.bugId },
    select: { milestoneId: true, testCaseId: true, milestone: { select: { status: true } } },
  })

  if (!existing || existing.milestoneId !== params.id) {
    return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
  }

  if (existing.testCaseId) {
    return NextResponse.json({
      error: 'Cannot delete bugs linked to a test case. Update the test case status instead.',
    }, { status: 400 })
  }

  if (existing.milestone.status === 'done') {
    return NextResponse.json({ error: 'Cannot delete bugs on approved milestones' }, { status: 400 })
  }

  await prisma.milestoneBug.delete({ where: { id: params.bugId } })
  return NextResponse.json({ ok: true })
}
