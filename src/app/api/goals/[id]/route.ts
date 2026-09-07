import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Founder', 'Dev', 'BD', 'QA', 'Both'])
  if (deny) return deny

  const data = await req.json()
  const update: { progressPct?: number; status?: string; title?: string } = {}

  if (data.progressPct !== undefined) {
    update.progressPct = parseInt(data.progressPct)
  }
  if (data.status) {
    update.status = data.status
    if (data.status === 'achieved') {
      update.progressPct = 100
    }
  }
  if (data.title) {
    update.title = data.title
  }

  const goal = await prisma.goal.update({
    where: { id: params.id },
    data: update,
  })

  revalidatePath('/goals')
  revalidatePath('/me')
  revalidatePath('/intelligence')

  return NextResponse.json(goal)
}
