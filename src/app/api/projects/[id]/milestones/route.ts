import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidateProjectsListCache } from '@/lib/cache-tags'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Dev', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const m = await prisma.milestone.create({
    data: { projectId: params.id, title: data.title, dueDate: new Date(data.dueDate) },
  })
  invalidateProjectsListCache()
  return NextResponse.json(m)
}
