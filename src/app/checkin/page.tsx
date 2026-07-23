import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getWeekStart } from '@/lib/utils'
import CheckInClient from './CheckInClient'

export const dynamic = 'force-dynamic'

export default async function CheckInPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const weekOf = getWeekStart()

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
      <div className="py-4">
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-green-50/30 p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-2xl text-white shadow-sm">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Already checked in this week</h1>
          <p className="text-sm text-gray-500 mb-1">You submitted your weekly check-in for this week.</p>
          <p className="text-sm text-gray-500 mb-6">Next check-in due Monday morning.</p>
          <Link href="/me" className="btn-primary inline-flex text-sm">
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
