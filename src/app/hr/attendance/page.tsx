import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { businessDayKey } from '@/lib/daily'
import { istDateInputValue } from '@/lib/ist'
import { buildAttendanceSheet } from '@/lib/attendance'
import AttendanceClient from './AttendanceClient'

export const dynamic = 'force-dynamic'

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Attendance never includes the live IST day — mid-day everyone looks Short. */
function maxAttendanceDayKey(todayKey = istDateInputValue()) {
  return shiftKey(todayKey, -1)
}

/** Default range: this week Mon–yesterday (IST). */
function defaultRange() {
  const todayKey = istDateInputValue()
  const maxTo = maxAttendanceDayKey(todayKey)
  const [y, m, d] = todayKey.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  const weekStart = shiftKey(todayKey, -mondayOffset)
  return { from: weekStart > maxTo ? maxTo : weekStart, to: maxTo }
}

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

export default async function HrAttendancePage({
  searchParams,
}: {
  searchParams?: { from?: string | string[]; to?: string | string[] }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const role = session.user.role
  if (role !== 'HR' && role !== 'Founder') {
    redirect(role === 'Manager' ? '/' : '/me')
  }

  const canEdit = role === 'HR'
  const defaults = defaultRange()
  const fromParam = one(searchParams?.from)
  const toParam = one(searchParams?.to)
  const from = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : defaults.from
  const to = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : defaults.to

  // Never include today — in-progress day falsely marks everyone Short
  const todayKey = businessDayKey()
  const maxTo = maxAttendanceDayKey(todayKey)
  const safeTo = to > maxTo ? maxTo : to
  const safeFrom = from > safeTo ? safeTo : from

  const sheet = await buildAttendanceSheet(safeFrom, safeTo)

  return (
    <AttendanceClient
      from={sheet.from}
      to={sheet.to}
      todayKey={todayKey}
      maxToKey={maxTo}
      canEdit={canEdit}
      role={role}
      sheet={sheet}
    />
  )
}
