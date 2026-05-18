import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { startOfWeek } from 'date-fns'
import Link from 'next/link'
import CheckInClient from './CheckInClient'

export const dynamic = 'force-dynamic'

export default async function CheckInPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const weekOf = startOfWeek(new Date())

  // Check if user already submitted check-in this week
  const existingCheckIn = await prisma.weeklyScore.findUnique({
    where: {
      memberId_weekOf_founderScore: {
        memberId: session.user.id,
        weekOf,
        founderScore: false,
      },
    },
  })

  // If already checked in, show message
  if (existingCheckIn) {
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Already checked in this week
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            You submitted your weekly check-in for this week.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Next check-in due: Monday morning.
          </p>
          <Link
            href="/me"
            className="inline-block btn-primary px-6 py-2.5 text-sm"
          >
            Back to My Day →
          </Link>
        </div>
      </div>
    )
  }

  const [members, projects] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({
      where: { status: { in: ['scoping', 'active', 'qa'] } },
      select: { id: true, name: true, developerId: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return <CheckInClient members={members} projects={projects} />
}
