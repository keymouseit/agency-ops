import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logProjectQAActivity } from '@/lib/qa-audit'
import { invalidateProjectCaches } from '@/lib/cache-tags'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Dev', 'Both', 'Founder'])
  if (deny) return deny

  const session = await auth()
  const createdById = session?.user?.id
  if (!createdById) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await req.json()
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  const notesRaw = typeof data.notes === 'string' ? data.notes.trim() : ''
  const notes = notesRaw || null
  const dueDateRaw = typeof data.dueDate === 'string' ? data.dueDate.trim() : ''
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const m = await prisma.milestone.create({
    data: { projectId: params.id, title, dueDate, notes, createdById },
  })

  await logProjectQAActivity(
    'created',
    project.id,
    project.name,
    {
      qaEventType: 'milestone_created',
      milestoneId: m.id,
      milestoneTitle: m.title,
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
    },
    req,
  )

  invalidateProjectCaches(project.id)
  return NextResponse.json(m)
}
