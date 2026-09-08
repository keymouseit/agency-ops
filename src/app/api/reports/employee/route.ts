import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { getEmployeeReport } from '@/lib/employee-report'
import { businessDayStart } from '@/lib/daily'
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'

export async function GET(req: Request) {
  const deny = await checkRole(['Founder', 'Manager'])
  if (deny) return deny

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const range = searchParams.get('range') || 'week'
  let from: Date
  let to: Date = businessDayStart()

  if (range === 'custom') {
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    if (!fromStr || !toStr) {
      return NextResponse.json({ error: 'from and to are required for custom range' }, { status: 400 })
    }
    from = businessDayStart(fromStr)
    to = businessDayStart(toStr)
  } else if (range === 'month') {
    from = startOfMonth(new Date())
    to = endOfMonth(new Date())
  } else {
    // week — full Mon–Sun week
    from = startOfWeek(new Date(), { weekStartsOn: 1 })
    to = endOfWeek(new Date(), { weekStartsOn: 1 })
  }

  if (from > to) {
    return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 })
  }

  // Cap custom ranges to ~1 year to keep queries sane
  const maxSpanDays = 400
  if ((to.getTime() - from.getTime()) / 86400000 > maxSpanDays) {
    return NextResponse.json({ error: 'Date range cannot exceed 400 days' }, { status: 400 })
  }

  const report = await getEmployeeReport(memberId, { from, to })
  if (!report) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  return NextResponse.json(report)
}
