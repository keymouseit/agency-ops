import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { startOfDay, subDays, isWeekend } from 'date-fns'
import EODClient from './EODClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EODPage({ searchParams }: { searchParams: { logId?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberId = session.user.id
  const today     = startOfDay(new Date())
  const yesterday = startOfDay(subDays(today, 1))

  // If logId provided and valid, use it directly (e.g. link from /me yesterday's EOD)
  if (searchParams.logId && searchParams.logId !== 'undefined' && searchParams.logId !== '') {
    const log = await prisma.dailyLog.findUnique({
      where: { id: searchParams.logId },
      include: {
        member: true,
        tasks: {
          include: { project: { select: { name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    })
    if (!log) notFound()
    // Security: only show your own log unless you're Founder
    if (log.memberId !== memberId && session.user.role !== 'Founder') {
      redirect('/daily/eod')
    }
    return <EODClient log={log} />
  }

  // No logId — find the member's most recent open log (today or yesterday)
  const openLog = await prisma.dailyLog.findFirst({
    where: {
      memberId,
      planSubmittedAt: { not: null },
      eodSubmittedAt: null,
      date: { in: [today, yesterday] },
    },
    include: {
      member: true,
      tasks: {
        include: { project: { select: { name: true } } },
        orderBy: { priority: 'asc' },
      },
    },
    orderBy: { date: 'desc' },
  })

  if (openLog) return <EODClient log={openLog} />

  // No open log found
  return (
    <div className="max-w-lg mx-auto py-16 text-center">
      <div className="text-4xl mb-4">🌙</div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">No open plan found</h1>
      <p className="text-gray-500 text-sm mb-6">
        You either haven&apos;t submitted a morning plan today, or your EOD is already done.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/daily/plan" className="btn-primary text-sm">Start today&apos;s plan →</Link>
        <Link href="/me" className="btn-secondary text-sm">My Day →</Link>
      </div>
    </div>
  )
}
