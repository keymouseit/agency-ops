import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRole, auth } from '@/lib/auth'
import { startOfWeek } from 'date-fns'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'SocialMedia'])
  if (deny) return deny

  const data = await req.json()
  const session = await auth()
  const weekOf = startOfWeek(new Date(), { weekStartsOn: 1 })
  const founderScore =
    data.founderScore === true ||
    data.founderScore === 'true' ||
    (session?.user?.role === 'Founder' && data.memberId !== session.user.id)

  const existing = await prisma.weeklyScore.findUnique({
    where: {
      memberId_weekOf_founderScore: { memberId: data.memberId, weekOf, founderScore },
    },
  })

  // Weekly self-assessment is once per week — no resubmission
  if (!founderScore && existing) {
    return NextResponse.json(
      { error: 'You already submitted your weekly check-in this week.' },
      { status: 409 }
    )
  }

  const score = await prisma.weeklyScore.upsert({
    where: { memberId_weekOf_founderScore: { memberId: data.memberId, weekOf, founderScore } },
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
      founderScore,
    },
  })
  return NextResponse.json(score)
}
