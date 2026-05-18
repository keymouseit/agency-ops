import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logQAAction, getClientIP } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const startTime = Date.now()
  logger.logApiRequest('POST', `/api/qa/${params.id}/cycle`, undefined)

  const deny = await checkRole(['QA', 'Founder'])
  if (deny) {
    logger.logApiResponse('POST', `/api/qa/${params.id}/cycle`, deny.status, Date.now() - startTime)
    return deny
  }

  const data = await req.json()
  logger.info('Creating QA test cycle', { projectId: params.id, result: data.result, conductedBy: data.conductedById })

  const cycle = await prisma.testCycle.create({
    data: {
      projectId: params.id,
      conductedById: data.conductedById,
      cycleType: data.cycleType,
      environment: data.environment || 'staging',
      result: data.result,
      completedAt: new Date(),
      // Checklist items
      testedAuth:          data.testedAuth          === true,
      testedCoreFlows:     data.testedCoreFlows     === true,
      testedEdgeCases:     data.testedEdgeCases     === true,
      testedMobile:        data.testedMobile        === true,
      testedCrossBrowser:  data.testedCrossBrowser  === true,
      testedPerformance:   data.testedPerformance   === true,
      testedIntegrations:  data.testedIntegrations  === true,
      testedDataIntegrity: data.testedDataIntegrity === true,
      // Report
      summary:      data.summary      || null,
      blockerNote:  data.blockerNote  || null,
      fixedInCycle: data.fixedInCycle || null,
    },
  })

  logger.info('QA test cycle created successfully', { cycleId: cycle.id, projectId: params.id, result: data.result })

  // Get project details for audit log and notifications
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { name: true, developerId: true } })

  // Log audit trail
  if (project) {
    await logQAAction(
      'submitted',
      'TestCycle',
      cycle.id,
      project.name,
      {
        result: data.result,
        cycleType: data.cycleType,
        environment: data.environment || 'staging',
        hasBlockers: data.result === 'fail' && !!data.blockerNote,
      },
      req
    )
  }

  // Notify based on result
  if (project) {
    logger.debug('Sending QA test cycle notifications', { projectId: params.id, projectName: project.name, result: data.result, developerId: project.developerId })

    if (data.result === 'fail') {
      // Notify the dev project owner: their project is blocked in QA
      logger.info('Sending test_cycle_fail notification to project owner', { projectId: params.id, developerId: project.developerId })
      await notify('test_cycle_fail', [project.developerId],
        `QA: ${project.name} is blocked — ${(data.blockerNote ?? 'see test report').slice(0, 80)}`,
        `/qa/${params.id}`)
      logger.info('test_cycle_fail notification sent', { projectId: params.id, developerId: project.developerId })
    } else if (data.result === 'pass' || data.result === 'conditional') {
      const label = data.result === 'conditional' ? 'conditional pass' : 'pass'

      // Notify the dev project owner: their project passed QA
      logger.info('Sending test_cycle_pass notification to project owner', { projectId: params.id, developerId: project.developerId, label })
      await notify('test_cycle_pass', [project.developerId],
        `QA: ${project.name} test cycle ${label} — great work!`,
        `/qa/${params.id}`)
      logger.info('test_cycle_pass notification sent to project owner', { projectId: params.id, developerId: project.developerId })

      // Notify QA team: project ready for sign-off
      const qaMembers = await prisma.teamMember.findMany({ where: { role: { in: ['QA','Both'] }, active: true }, select: { id: true } })
      logger.debug('Found QA members for notification', { count: qaMembers.length, memberIds: qaMembers.map(m => m.id) })

      if (qaMembers.length) {
        logger.info('Sending test_cycle_pass notification to QA team', { projectId: params.id, qaCount: qaMembers.length })
        await notify('test_cycle_pass', qaMembers.map(m => m.id),
          `${project.name} test cycle: ${label} — ready for sign-off`,
          `/qa/${params.id}`)
        logger.info('test_cycle_pass notification sent to QA team', { projectId: params.id, qaCount: qaMembers.length })
      }
    }
  } else {
    logger.warn('Project not found when trying to send notifications', { projectId: params.id })
  }

  logger.logApiResponse('POST', `/api/qa/${params.id}/cycle`, 200, Date.now() - startTime)
  return NextResponse.json(cycle)
}
