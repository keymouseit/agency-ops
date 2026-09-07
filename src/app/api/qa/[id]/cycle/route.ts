import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logProjectQAActivity } from '@/lib/qa-audit'
import {
  buildTestCycleFields,
  parseTestCycleCases,
  validateTestCyclePayload,
} from '@/lib/test-cycle-form'

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

  if (!data.conductedById) {
    return NextResponse.json({ error: 'Tested by is required' }, { status: 400 })
  }

  const rawCases = Array.isArray(data.testCases) ? data.testCases : []
  const testCases = parseTestCycleCases(rawCases)

  if (testCases.length === 0) {
    return NextResponse.json({ error: 'At least one test case with a name is required' }, { status: 400 })
  }

  const fields = buildTestCycleFields(data, testCases)
  const errors = validateTestCyclePayload(fields, testCases)
  if (errors.length) {
    return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
  }

  const cycle = await prisma.$transaction(async tx => {
    const created = await tx.testCycle.create({
      data: {
        projectId: params.id,
        conductedById: fields.conductedById,
        cycleType: fields.cycleType,
        environment: fields.environment || 'staging',
        result: fields.result,
        completedAt: new Date(),
        testedAuth: fields.testedAuth,
        testedCoreFlows: fields.testedCoreFlows,
        testedEdgeCases: fields.testedEdgeCases,
        testedMobile: fields.testedMobile,
        testedCrossBrowser: fields.testedCrossBrowser,
        testedPerformance: fields.testedPerformance,
        testedIntegrations: fields.testedIntegrations,
        testedDataIntegrity: fields.testedDataIntegrity,
        summary: fields.summary,
        blockerNote: fields.blockerNote,
        fixedInCycle: fields.fixedInCycle,
      },
    })

    await tx.testCycleCase.createMany({
      data: testCases.map(tc => ({ ...tc, testCycleId: created.id })),
    })

    return created
  })

  logger.info('QA test cycle created successfully', { cycleId: cycle.id, projectId: params.id, result: fields.result })

  // Get project details for audit log and notifications
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { name: true, developerId: true } })

  // Log audit trail
  if (project) {
    const passedCount = testCases.filter((tc: { status?: string }) => tc.status === 'pass' || tc.status === 'skipped').length
    await logProjectQAActivity(
      'submitted',
      params.id,
      project.name,
      {
        qaEventType: 'test_cycle_logged',
        cycleId: cycle.id,
        result: fields.result,
        cycleType: fields.cycleType,
        environment: fields.environment || 'staging',
        passedCount,
        totalCases: testCases.length,
        hasBlockers: fields.result === 'fail' && !!fields.blockerNote,
      },
      req,
    )
  }

  // Notify based on result
  if (project) {
    logger.debug('Sending QA test cycle notifications', { projectId: params.id, projectName: project.name, result: fields.result, developerId: project.developerId })

    if (fields.result === 'fail') {
      // Notify the dev project owner: their project is blocked in QA
      logger.info('Sending test_cycle_fail notification to project owner', { projectId: params.id, developerId: project.developerId })
      await notify('test_cycle_fail', [project.developerId],
        `QA: ${project.name} is blocked — ${(fields.blockerNote ?? 'see test report').slice(0, 80)}`,
        `/projects/${params.id}#qa`)
      logger.info('test_cycle_fail notification sent', { projectId: params.id, developerId: project.developerId })
    } else if (fields.result === 'pass' || fields.result === 'conditional') {
      const label = fields.result === 'conditional' ? 'conditional pass' : 'pass'

      // Notify the dev project owner: their project passed QA
      logger.info('Sending test_cycle_pass notification to project owner', { projectId: params.id, developerId: project.developerId, label })
      await notify('test_cycle_pass', [project.developerId],
        `QA: ${project.name} test cycle ${label} — great work!`,
        `/projects/${params.id}#qa`)
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
