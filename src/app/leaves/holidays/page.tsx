import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { businessDayKey } from '@/lib/daily'
import { canManageHolidays, listHolidays } from '@/lib/holidays'
import HolidaysClient from './HolidaysClient'

export const dynamic = 'force-dynamic'

/** Company holiday calendar — every signed-in employee can view all years; HR / Founder / Manager can edit. */
export default async function HolidaysPage({ searchParams }: { searchParams?: { year?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { holidays, source } = await listHolidays()
  const todayKey = businessDayKey()
  const yearParam = searchParams?.year
  const initialYear = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : Number(todayKey.slice(0, 4))

  return (
    <HolidaysClient
      initialHolidays={holidays}
      todayKey={todayKey}
      initialYear={initialYear}
      canManage={canManageHolidays(session.user.role)}
      usingFallback={source === 'fallback'}
    />
  )
}
