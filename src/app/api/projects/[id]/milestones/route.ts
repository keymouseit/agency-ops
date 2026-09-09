import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidateProjectsListCache } from '@/lib/cache-tags'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Dev', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  const dueDateRaw = typeof data.dueDate === 'string' ? data.dueDate.trim() : ''
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
  }
  const m = await prisma.milestone.create({
    data: { projectId: params.id, title, dueDate },
  })
  invalidateProjectsListCache()
  return NextResponse.json(m)
}
