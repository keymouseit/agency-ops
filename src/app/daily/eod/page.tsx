import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findOpenDailyLog, dailyLogWithTasksInclude } from '@/lib/daily'
import { redirect, notFound } from 'next/navigation'
import EODClient from './EODClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EODPage({ searchParams }: { searchParams: { logId?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberId = session.user.id

  // Explicit logId — e.g. link from /me for a specific day
  if (searchParams.logId && searchParams.logId !== 'undefined' && searchParams.logId !== '') {
    const log = await prisma.dailyLog.findUnique({
      where: { id: searchParams.logId },
      include: dailyLogWithTasksInclude,
    })
    if (!log) notFound()
    if (log.memberId !== memberId && session.user.role !== 'Founder') {
      redirect('/daily/eod')
    }
    return <EODClient log={log} />
  }

  // No logId — auto-detect the logged-in user's open DailyLog
  const openLog = await findOpenDailyLog(memberId)

  if (openLog) return <EODClient log={openLog} />

  return (
    <div className="max-w-lg mx-auto py-16 text-center">
      <div className="text-4xl mb-4">🌙</div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">No open plan found</h1>
      <p className="text-gray-500 text-sm mb-6">
        You either haven&apos;t submitted a morning plan yet, or your EOD is already done.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/daily/plan" className="btn-primary text-sm">Start today&apos;s plan →</Link>
        <Link href="/me" className="btn-secondary text-sm">My Day →</Link>
      </div>
    </div>
  )
}
