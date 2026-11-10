import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageHolidays, dateKeyToDbDate, dbDateToDateKey } from '@/lib/holidays'
import { isUniqueViolation, parseHolidayInput } from '@/lib/holiday-input'
import { revalidateHolidayPages } from '@/lib/holiday-revalidate'

export const dynamic = 'force-dynamic'

async function requireEditor() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  if (!canManageHolidays(session.user.role)) {
    return NextResponse.json({ error: 'Only HR, Founder or Manager can manage holidays.' }, { status: 403 })
  }
  return null
}

/** PATCH /api/leaves/holidays/:id — edit date, name or type. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireEditor()
  if (denied) return denied

  const parsed = parseHolidayInput(await request.json().catch(() => null), true)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { date, name, type } = parsed.value

  try {
    const row = await prisma.holiday.update({
      where: { id: params.id },
      data: {
        ...(date ? { date: dateKeyToDbDate(date) } : {}),
        ...(name ? { name } : {}),
        ...(type ? { type } : {}),
      },
    })
    revalidateHolidayPages()
    return NextResponse.json({
      holiday: { id: row.id, date: dbDateToDateKey(row.date), name: row.name, type: row.type },
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'Another holiday already exists on that date.' }, { status: 409 })
    }
    if ((err as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Holiday not found.' }, { status: 404 })
    }
    console.error('[holidays] update failed', err)
    return NextResponse.json({ error: 'Could not update the holiday. Try again.' }, { status: 500 })
  }
}

/** DELETE /api/leaves/holidays/:id */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireEditor()
  if (denied) return denied

  try {
    await prisma.holiday.delete({ where: { id: params.id } })
    revalidateHolidayPages()
    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Holiday not found.' }, { status: 404 })
    }
    console.error('[holidays] delete failed', err)
    return NextResponse.json({ error: 'Could not delete the holiday. Try again.' }, { status: 500 })
  }
}
