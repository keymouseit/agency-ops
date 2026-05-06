import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['QA', 'Founder'])
  if (deny) return deny

  const data = await req.json()

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

  // Notify based on result
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { name: true, ownerId: true } })
  if (project) {
    if (data.result === 'fail') {
      // Notify the dev project owner: their project is blocked in QA
      await notify('test_cycle_fail', [project.ownerId],
        `QA: ${project.name} is blocked — ${(data.blockerNote ?? 'see test report').slice(0, 80)}`,
        `/qa/${params.id}`)
    } else if (data.result === 'pass' || data.result === 'conditional') {
      // Notify QA team: project ready for sign-off
      const qaMembers = await prisma.teamMember.findMany({ where: { role: { in: ['QA','Both'] }, active: true }, select: { id: true } })
      if (qaMembers.length) {
        const label = data.result === 'conditional' ? 'conditional pass' : 'pass'
        await notify('test_cycle_pass', qaMembers.map(m => m.id),
          `${project.name} test cycle: ${label} — ready for sign-off`,
          `/qa/${params.id}`)
      }
    }
  }

  return NextResponse.json(cycle)
}
