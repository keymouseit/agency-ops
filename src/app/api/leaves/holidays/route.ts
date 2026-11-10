import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageHolidays, dateKeyToDbDate, listHolidays } from '@/lib/holidays'
import { isUniqueViolation, parseHolidayInput } from '@/lib/holiday-input'
import { revalidateHolidayPages } from '@/lib/holiday-revalidate'

export const dynamic = 'force-dynamic'

/** GET /api/leaves/holidays[?year=2027] — every signed-in user can read the calendar. */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const yearParam = new URL(request.url).searchParams.get('year')
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null
  const { holidays, source } = await listHolidays(
    year ? { from: `${year}-01-01`, to: `${year}-12-31` } : {},
  )
  return NextResponse.json({ holidays, source })
}

/** POST /api/leaves/holidays — HR / Founder / Manager add a holiday (any year). */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  if (!canManageHolidays(session.user.role)) {
    return NextResponse.json({ error: 'Only HR, Founder or Manager can manage holidays.' }, { status: 403 })
  }

  const parsed = parseHolidayInput(await request.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { date, name, type } = parsed.value as Required<typeof parsed.value>

  try {
    const row = await prisma.holiday.create({
      data: { date: dateKeyToDbDate(date), name, type },
    })
    revalidateHolidayPages()
    return NextResponse.json({ holiday: { id: row.id, date, name: row.name, type: row.type } }, { status: 201 })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'A holiday already exists on that date. Edit it instead.' }, { status: 409 })
    }
    console.error('[holidays] create failed', err)
    return NextResponse.json({ error: 'Could not save the holiday. Try again.' }, { status: 500 })
  }
}
