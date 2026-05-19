import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['QA', 'Both', 'Founder'])
  if (deny) return deny

  // Verify project has QA sign-off before allowing post-delivery issues
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { releaseSignOff: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.releaseSignOff) {
    return NextResponse.json(
      { error: 'Post-delivery issues can only be logged after QA has signed off the project' },
      { status: 403 }
    )
  }

  const data = await req.json()

  const issue = await prisma.postDeliveryIssue.create({
    data: {
      projectId:      params.id,
      description:    data.description,
      severity:       data.severity   || 'medium',
      reportedBy:     data.reportedBy || 'Client',
      wasInScope:     data.wasInScope === true ? true : data.wasInScope === false ? false : null,
      rootCause:      data.rootCause  || null,
    },
  })

  return NextResponse.json(issue)
}
