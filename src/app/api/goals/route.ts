import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const deny = await checkRole(['Founder'])
  if (deny) return deny

  const data = await req.json()
  const goal = await prisma.goal.create({
    data: {
      memberId: data.memberId,
      title: data.title,
      description: data.description || null,
      category: data.category || 'delivery',
      quarter: data.quarter,
      successMetric: data.successMetric || null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
    },
  })
  return NextResponse.json(goal)
}
