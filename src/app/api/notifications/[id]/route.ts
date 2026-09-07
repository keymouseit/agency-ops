import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia', 'Manager'])
  if (deny) return deny

  await prisma.notification.update({
    where: { id: params.id },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
