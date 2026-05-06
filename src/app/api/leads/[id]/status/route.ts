import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder'])
  if (deny) return deny

  const { status } = await req.json()
  const lead = await prisma.lead.update({ where: { id: params.id }, data: { status } })
  return NextResponse.json(lead)
}
