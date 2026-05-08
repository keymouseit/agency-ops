import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  const { status } = await req.json()

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
    },
  })
  // Notify QA team when project moves to QA stage
  if (status === 'qa') {
    const qaMembers = await prisma.teamMember.findMany({ where: { role: { in: ['QA', 'Both'] }, active: true }, select: { id: true } })
    if (qaMembers.length) {
      await notify('project_in_qa', qaMembers.map(m => m.id),
        `${p.name} has moved to QA — testing needed before release`,
        `/qa/${p.id}`)
    }
  }

  return NextResponse.json(p)
}
