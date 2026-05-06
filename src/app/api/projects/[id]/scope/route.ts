import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const sc = await prisma.scopeChange.create({
    data: {
      projectId: params.id,
      requestedBy: data.requestedBy || 'client',
      description: data.description,
      hoursAdded: data.hoursAdded ? parseFloat(data.hoursAdded) : null,
      valueAdded: data.valueAdded ? parseFloat(data.valueAdded) : null,
      changeOrderSigned: data.changeOrderSigned === 'true' || data.changeOrderSigned === true,
      approvedById: data.approvedById || null,
    },
  })
  return NextResponse.json(sc)
}
