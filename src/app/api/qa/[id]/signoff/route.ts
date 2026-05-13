import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logQAAction, getClientIP } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const startTime = Date.now()
  logger.logApiRequest('POST', `/api/qa/${params.id}/signoff`, undefined)

  const deny = await checkRole(['QA', 'Founder'])
  if (deny) {
    logger.logApiResponse('POST', `/api/qa/${params.id}/signoff`, deny.status, Date.now() - startTime)
    return deny
  }

  const data = await req.json()
  logger.info('Processing QA release sign-off', { projectId: params.id, signedOffBy: data.signedOffById })

  // Verify the cycle linked to this sign-off actually passed or conditional
  const cycle = await prisma.testCycle.findUnique({
    where: { id: data.cycleId },
  })

  if (!cycle) {
    return NextResponse.json(
      { error: 'Test cycle not found.' },
      { status: 400 }
    )
  }

  if (cycle.result === 'fail') {
    return NextResponse.json(
      { error: 'Cannot sign off on a failed test cycle. The blocker must be resolved and a new cycle run first.' },
      { status: 422 }
    )
  }

  if (cycle.result === 'pending') {
    return NextResponse.json(
      { error: 'The test cycle is still in progress. Mark it as pass or conditional before signing off.' },
      { status: 422 }
    )
  }

  const signOff = await prisma.releaseSignOff.upsert({
    where: { projectId: params.id },
    update: {
      cycleId:            data.cycleId,
      signedOffById:      data.signedOffById,
      signedOffAt:        new Date(),
      sanityPassed:       data.sanityPassed       === true,
      regressionPassed:   data.regressionPassed   === true,
      noBlockersOpen:     data.noBlockersOpen      === true,
      stagingMatchesLive: data.stagingMatchesLive  === true,
      clientUATDone:      data.clientUATDone       === true,
      knownIssuesAgreed:  data.knownIssuesAgreed   === true,
      exceptionsNotes:    data.exceptionsNotes     || null,
      qualityScore:       data.qualityScore        ? parseInt(data.qualityScore) : null,
      releaseNotes:       data.releaseNotes        || null,
    },
    create: {
      projectId:          params.id,
      cycleId:            data.cycleId,
      signedOffById:      data.signedOffById,
      sanityPassed:       data.sanityPassed       === true,
      regressionPassed:   data.regressionPassed   === true,
      noBlockersOpen:     data.noBlockersOpen      === true,
      stagingMatchesLive: data.stagingMatchesLive  === true,
      clientUATDone:      data.clientUATDone       === true,
      knownIssuesAgreed:  data.knownIssuesAgreed   === true,
      exceptionsNotes:    data.exceptionsNotes     || null,
      qualityScore:       data.qualityScore        ? parseInt(data.qualityScore) : null,
      releaseNotes:       data.releaseNotes        || null,
    },
  })

  // Get project name for audit log
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { name: true },
  })

  // Log audit trail
  if (project) {
    await logQAAction(
      'signed_off',
      'ReleaseSignOff',
      signOff.id,
      project.name,
      {
        qualityScore: signOff.qualityScore,
        cycleId: data.cycleId,
        signedOffById: data.signedOffById,
        allChecksPassed: data.sanityPassed && data.regressionPassed && data.noBlockersOpen,
      },
      req
    )

    logger.info('QA release sign-off created', {
      projectId: params.id,
      projectName: project.name,
      signOffId: signOff.id,
      qualityScore: signOff.qualityScore,
    })
  }

  logger.logApiResponse('POST', `/api/qa/${params.id}/signoff`, 200, Date.now() - startTime)
  return NextResponse.json(signOff)
}
