import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logProjectQAActivity } from '@/lib/qa-audit'
import {
  buildTestCycleFields,
  parseTestCycleCases,
  validateTestCyclePayload,
} from '@/lib/test-cycle-form'

async function loadCycle(projectId: string, cycleId: string) {
  return prisma.testCycle.findUnique({
    where: { id: cycleId },
    include: {
      signOff: true,
      project: { select: { id: true, name: true } },
    },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; cycleId: string } },
) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const existing = await loadCycle(params.id, params.cycleId)
  if (!existing || existing.projectId !== params.id) {
    return NextResponse.json({ error: 'Test cycle not found' }, { status: 404 })
  }
  if (existing.signOff) {
    return NextResponse.json({ error: 'Cannot edit a test cycle that has been signed off' }, { status: 400 })
  }

  const data = await req.json()
  const testCases = parseTestCycleCases(data.testCases)
  const fields = buildTestCycleFields(data, testCases)
  const errors = validateTestCyclePayload(fields, testCases)
  if (errors.length) {
    return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
  }

  const updated = await prisma.$transaction(async tx => {
    await tx.testCycleCase.deleteMany({ where: { testCycleId: params.cycleId } })
    const cycle = await tx.testCycle.update({
      where: { id: params.cycleId },
      data: {
        conductedById: fields.conductedById,
        cycleType: fields.cycleType,
        environment: fields.environment,
        result: fields.result,
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
      data: testCases.map(tc => ({ ...tc, testCycleId: params.cycleId })),
    })
    return cycle
  })

  const passedCount = testCases.filter(tc => tc.status === 'pass' || tc.status === 'skipped').length
  await logProjectQAActivity(
    'updated',
    params.id,
    existing.project.name,
    {
      qaEventType: 'test_cycle_updated',
      cycleId: updated.id,
      result: fields.result,
      cycleType: fields.cycleType,
      environment: fields.environment,
      passedCount,
      totalCases: testCases.length,
    },
    req,
  )

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; cycleId: string } },
) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const existing = await loadCycle(params.id, params.cycleId)
  if (!existing || existing.projectId !== params.id) {
    return NextResponse.json({ error: 'Test cycle not found' }, { status: 404 })
  }
  if (existing.signOff) {
    return NextResponse.json({ error: 'Cannot delete a test cycle that has been signed off' }, { status: 400 })
  }

  await prisma.testCycle.delete({ where: { id: params.cycleId } })

  await logProjectQAActivity(
    'deleted',
    params.id,
    existing.project.name,
    {
      qaEventType: 'test_cycle_deleted',
      cycleId: params.cycleId,
      cycleType: existing.cycleType,
      result: existing.result,
    },
  )

  return NextResponse.json({ ok: true })
}
