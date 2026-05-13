import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logProjectChange, getClientIP } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const startTime = Date.now()
  try {
    const deny = await checkRole(['Dev', 'Both', 'Founder', 'Manager'])
    if (deny) return deny

    const { status, qaHandoff } = await req.json()
    const session = await auth()
    const userRole = session?.user?.role

    logger.logApiRequest('POST', `/api/projects/${params.id}/status`, session?.user?.id)
    logger.info('Project status change requested', { projectId: params.id, newStatus: status, userRole })

    // Get current project data for audit trail
    const oldProject = await prisma.project.findUnique({
      where: { id: params.id },
      select: { name: true, status: true },
    })

    if (!oldProject) {
      logger.warn('Project not found for status update', { projectId: params.id })
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Validate QA handoff data when moving to QA status
    if (status === 'qa') {
      if (!qaHandoff || typeof qaHandoff !== 'object') {
        return NextResponse.json(
          { error: 'QA handoff information is required when moving a project to QA status' },
          { status: 400 }
        )
      }
      if (!qaHandoff.modulesDelivered || !qaHandoff.modulesDelivered.trim()) {
        return NextResponse.json(
          { error: 'QA Handoff: "Modules/Features delivered" is required' },
          { status: 400 }
        )
      }
      if (!qaHandoff.suggestedTestType || !qaHandoff.suggestedTestType.trim()) {
        return NextResponse.json(
          { error: 'QA Handoff: "Suggested test type" is required' },
          { status: 400 }
        )
      }
    }

    // Developers cannot set project to 'cancelled' (only Founder/Manager can)
    if (status === 'cancelled' && userRole && ['Dev'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Only Founder or Manager can cancel projects. Please contact your manager.' },
        { status: 403 }
      )
    }

    // Hard gate: cannot mark delivered without QA sign-off and signed COs
    if (status === 'delivered') {
      const [signOff, unsignedCOs] = await Promise.all([
        prisma.releaseSignOff.findUnique({ where: { projectId: params.id } }),
        prisma.scopeChange.count({
          where: { projectId: params.id, changeOrderSigned: false },
        }),
      ])

      if (!signOff) {
        return NextResponse.json(
          { error: 'QA release sign-off is required before marking a project as delivered.' },
          { status: 422 }
        )
      }
      if (unsignedCOs > 0) {
        return NextResponse.json(
          { error: `${unsignedCOs} scope change(s) are still missing a signed change order.` },
          { status: 422 }
        )
      }
    }

    const p = await prisma.project.update({
      where: { id: params.id },
      data: {
        status,
        ...(status === 'delivered' && { actualEnd: new Date() }),
        ...(status === 'qa' && qaHandoff && {
          qaModulesDelivered: qaHandoff.modulesDelivered,
          qaSuggestedTestType: qaHandoff.suggestedTestType,
          qaTestingNotes: qaHandoff.testingNotes,
          qaAreasChanged: qaHandoff.areasChanged,
          qaHandoffAt: new Date(),
        }),
      },
    })

    // Log audit trail
    await logProjectChange(
      'status_changed',
      params.id,
      p.name,
      {
        status: { old: oldProject.status, new: status },
      },
      {
        qaHandoff: status === 'qa' && qaHandoff ? qaHandoff : undefined,
        deliveredWithSignOff: status === 'delivered',
      },
      req
    )

    logger.info('Project status updated', {
      projectId: params.id,
      projectName: p.name,
      oldStatus: oldProject.status,
      newStatus: status,
    })

    // Notify QA team when project moves to QA stage
    if (status === 'qa') {
      const qaMembers = await prisma.teamMember.findMany({ where: { role: { in: ['QA', 'Both'] }, active: true }, select: { id: true } })
      if (qaMembers.length) {
        const handoffSummary = qaHandoff?.modulesDelivered
          ? ` — ${qaHandoff.modulesDelivered.slice(0, 60)}${qaHandoff.modulesDelivered.length > 60 ? '...' : ''}`
          : ''
        await notify('project_in_qa', qaMembers.map(m => m.id),
          `${p.name} has moved to QA${handoffSummary}`,
          `/qa/${p.id}`)
      }
    }

    logger.logApiResponse('POST', `/api/projects/${params.id}/status`, 200, Date.now() - startTime)
    return NextResponse.json(p)
  } catch (error) {
    logger.error('Error updating project status', error as Error, { projectId: params.id })
    logger.logApiResponse('POST', `/api/projects/${params.id}/status`, 500, Date.now() - startTime)
    console.error('[projects/status] Error updating project status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project status' },
      { status: 500 }
    )
  }
}
