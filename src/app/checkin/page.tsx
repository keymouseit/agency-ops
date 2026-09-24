import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getWeekStart } from '@/lib/utils'
import { checkInProjectsForMember } from '@/lib/checkin'
import CheckInClient from './CheckInClient'

export const dynamic = 'force-dynamic'

export default async function CheckInPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberId = session.user.id
  const weekOf = getWeekStart()

  const [members, projects, existingProjectCheckIns, existingSelfScore] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({
      where: { status: { in: ['scoping', 'active', 'qa'] } },
      select: {
        id: true,
        name: true,
        developerId: true,
        bdMemberId: true,
        status: true,
        assignees: { select: { memberId: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.projectCheckIn.findMany({
      where: { submittedById: memberId, weekOf },
      select: {
        id: true,
        projectId: true,
        progressPct: true,
        onTrack: true,
        scopeChange: true,
        clientUpdated: true,
        blockers: true,
        notes: true,
        createdAt: true,
        project: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.weeklyScore.findUnique({
      where: {
        memberId_weekOf_founderScore: {
          memberId,
          weekOf,
          founderScore: false,
        },
      },
    }),
  ])

  const mappedProjects = projects.map(p => ({
    id: p.id,
    name: p.name,
    developerId: p.developerId,
    bdMemberId: p.bdMemberId,
    status: p.status,
    assigneeIds: p.assignees.map(a => a.memberId),
  }))

  const member = members.find(m => m.id === memberId)
  const availableProjects = member
    ? checkInProjectsForMember(mappedProjects, memberId, member.role)
    : []
  const thisWeekCheckIns = existingProjectCheckIns.map(c => ({
    id: c.id,
    projectId: c.projectId,
    projectName: c.project.name,
    progressPct: c.progressPct,
    onTrack: c.onTrack,
    scopeChange: c.scopeChange,
    clientUpdated: c.clientUpdated,
    blockers: c.blockers,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  }))
  const checkedInProjectIds = thisWeekCheckIns.map(c => c.projectId)
  const checkedInSet = new Set(checkedInProjectIds)
  const remainingProjects = availableProjects.filter(p => !checkedInSet.has(p.id))
  const selfScoreDone = !!existingSelfScore
  const thisWeekSelfScore = existingSelfScore
    ? {
        id: existingSelfScore.id,
        delivery: existingSelfScore.delivery,
        process: existingSelfScore.process,
        communication: existingSelfScore.communication,
        growth: existingSelfScore.growth,
        culture: existingSelfScore.culture,
        selfNotes: existingSelfScore.selfNotes,
        repeatedMistake: existingSelfScore.repeatedMistake,
        createdAt: existingSelfScore.createdAt.toISOString(),
      }
    : null

  const initialStep = remainingProjects.length === 0 && !selfScoreDone ? 'self' : 'project'

  return (
    <CheckInClient
      members={members}
      projects={mappedProjects}
      thisWeekCheckIns={thisWeekCheckIns}
      selfScoreDone={selfScoreDone}
      thisWeekSelfScore={thisWeekSelfScore}
      initialStep={initialStep}
    />
  )
}
