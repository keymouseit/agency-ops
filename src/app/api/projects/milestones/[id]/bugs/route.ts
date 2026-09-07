import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { isValidBugSeverity, serializeMilestoneBug } from '@/lib/milestone-bugs'

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
  const data = await req.json()
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const description = typeof data.description === 'string' ? data.description.trim() || null : null
  const severity = typeof data.severity === 'string' ? data.severity : 'medium'

  if (!title) {
    return NextResponse.json({ error: 'Bug title is required' }, { status: 400 })
  }
  if (!isValidBugSeverity(severity)) {
    return NextResponse.json({ error: 'Invalid severity' }, { status: 400 })
  }
  if (!['testing', 'done', 'ready_for_qa'].includes(milestone!.status)) {
    return NextResponse.json({ error: 'Milestone is not available for bug logging' }, { status: 400 })
  }

  const bug = await prisma.milestoneBug.create({
    data: {
      milestoneId: params.id,
      title,
      description,
      severity,
      reportedById: session!.user!.id,
    },
    include: { reportedBy: { select: { name: true } } },
  })

  await notify(
    'milestone_bug_logged',
    [milestone!.project.developerId],
    `Bug logged: ${title} (${milestone!.title})`,
    `/projects/${milestone!.project.id}#qa`
  )

  return NextResponse.json(serializeMilestoneBug(bug), { status: 201 })
}
