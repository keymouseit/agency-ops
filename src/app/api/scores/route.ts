import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek } from 'date-fns'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const weekOf = startOfWeek(new Date())
  const score = await prisma.weeklyScore.upsert({
    where: { memberId_weekOf_founderScore: { memberId: data.memberId, weekOf, founderScore: false } },
    update: {
      delivery: parseInt(data.delivery),
      process: parseInt(data.process),
      communication: parseInt(data.communication),
      growth: parseInt(data.growth),
      culture: parseInt(data.culture),
      selfNotes: data.selfNotes || null,
      repeatedMistake: data.repeatedMistake === 'true' || data.repeatedMistake === true,
    },
    create: {
      memberId: data.memberId,
      weekOf,
      delivery: parseInt(data.delivery),
      process: parseInt(data.process),
      communication: parseInt(data.communication),
      growth: parseInt(data.growth),
      culture: parseInt(data.culture),
      selfNotes: data.selfNotes || null,
      repeatedMistake: data.repeatedMistake === 'true' || data.repeatedMistake === true,
      founderScore: false,
    },
  })
  return NextResponse.json(score)
}
