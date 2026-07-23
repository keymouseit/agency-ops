import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logProjectQAActivity } from '@/lib/qa-audit'
import { deriveCycleResult, hasFailingTestCases } from '@/lib/qa'

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
  const testCases = rawCases
    .filter((tc: { title?: string }) => typeof tc.title === 'string' && tc.title.trim())
    .map((tc: { title: string; status?: string; notes?: string }, i: number) => ({
      title: tc.title.trim(),
      status: ['pass', 'fail', 'blocked', 'skipped'].includes(tc.status ?? '') ? tc.status : 'pass',
      notes: tc.notes?.trim() || null,
      sortOrder: i,
    }))

  if (testCases.length === 0) {
    return NextResponse.json({ error: 'At least one test case with a name is required' }, { status: 400 })
  }

  const result = deriveCycleResult(data.result, testCases)

  const blockerNote = data.blockerNote?.trim()
    || (result === 'fail' && hasFailingTestCases(testCases)
      ? `Failed test cases: ${testCases.filter((tc: { status?: string; title: string }) => tc.status === 'fail' || tc.status === 'blocked').map((tc: { title: string }) => tc.title).join(', ')}`
      : null)

  const cycle = await prisma.$transaction(async tx => {
    const created = await tx.testCycle.create({
      data: {
        projectId: params.id,
        conductedById: data.conductedById,
        cycleType: data.cycleType,
        environment: data.environment || 'staging',
        result,
        completedAt: new Date(),
        testedAuth:          data.testedAuth          === true,
        testedCoreFlows:     data.testedCoreFlows     === true,
        testedEdgeCases:     data.testedEdgeCases     === true,
        testedMobile:        data.testedMobile        === true,
        testedCrossBrowser:  data.testedCrossBrowser  === true,
        testedPerformance:   data.testedPerformance   === true,
        testedIntegrations:  data.testedIntegrations  === true,
        testedDataIntegrity: data.testedDataIntegrity === true,
        summary:      data.summary      || null,
        blockerNote,
        fixedInCycle: data.fixedInCycle || null,
      },
    })

    await tx.testCycleCase.createMany({
      data: testCases.map(tc => ({ ...tc, testCycleId: created.id })),
    })

    return created
  })

  logger.info('QA test cycle created successfully', { cycleId: cycle.id, projectId: params.id, result })

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
        result,
        cycleType: data.cycleType,
        environment: data.environment || 'staging',
        passedCount,
        totalCases: testCases.length,
        hasBlockers: result === 'fail' && !!blockerNote,
      },
      req,
    )
  }

  // Notify based on result
  if (project) {
    logger.debug('Sending QA test cycle notifications', { projectId: params.id, projectName: project.name, result, developerId: project.developerId })

    if (result === 'fail') {
      // Notify the dev project owner: their project is blocked in QA
      logger.info('Sending test_cycle_fail notification to project owner', { projectId: params.id, developerId: project.developerId })
      await notify('test_cycle_fail', [project.developerId],
        `QA: ${project.name} is blocked — ${(blockerNote ?? 'see test report').slice(0, 80)}`,
        `/projects/${params.id}#qa`)
      logger.info('test_cycle_fail notification sent', { projectId: params.id, developerId: project.developerId })
    } else if (result === 'pass' || result === 'conditional') {
      const label = result === 'conditional' ? 'conditional pass' : 'pass'

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
