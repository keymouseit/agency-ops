import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['QA', 'Both', 'Founder'])
  if (deny) return deny

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
