import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeeLeaveUsage } from '@/lib/leave-usage'
import { getAvailableLeaveDays } from '@/lib/leave-balance'
import { endOfDay, parseISO, startOfDay, isValid } from 'date-fns'
import { formatIst, istDateInputValue } from '@/lib/ist'

function csvEscape(value: string | number | boolean | null | undefined) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function leaveTypeLabel(type: string, slot?: string | null) {
  let base = type.replace(/_/g, ' ')
  if (slot) base += ` (${slot.replace(/_/g, ' ')})`
  return base
}

export async function GET(request: Request) {
  const deny = await checkRole(['Founder', 'HR'])
  if (deny) return deny

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')
  const formatParam = searchParams.get('format')

  if (!memberId || !fromRaw || !toRaw) {
    return NextResponse.json({ error: 'memberId, from, and to are required' }, { status: 400 })
  }

  const from = startOfDay(parseISO(fromRaw))
  const to = endOfDay(parseISO(toRaw))
  if (!isValid(from) || !isValid(to)) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }
  if (from > to) {
    return NextResponse.json({ error: 'From date must be before to date' }, { status: 400 })
  }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, email: true, role: true, active: true },
  })
  if (!member || !member.active) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  const usage = await getEmployeeLeaveUsage(memberId, from, to)
  const { balance, available } = await getAvailableLeaveDays(memberId)

  if (formatParam === 'csv') {
    const lines: string[] = []
    lines.push('Employee Leave Usage Report')
    lines.push(`Generated,${csvEscape(`${istDateInputValue()} ${formatIst(new Date(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`)}`)
    lines.push('')
    lines.push('Employee')
    lines.push(['Name', 'Email', 'Role'].map(csvEscape).join(','))
    lines.push([member.name, member.email, member.role].map(csvEscape).join(','))
    lines.push('')
    lines.push('Period')
    lines.push(['From', 'To'].map(csvEscape).join(','))
    lines.push([fromRaw, toRaw].map(csvEscape).join(','))
    lines.push('')
    lines.push(`Leave Balance (${balance.year})`)
    lines.push(
      ['Accrued', 'Used', 'Available', 'Short Leaves']
        .map(csvEscape)
        .join(',')
    )
    lines.push(
      [balance.accrued, balance.used, available, balance.shortLeaves]
        .map(csvEscape)
        .join(',')
    )
    lines.push('')
    lines.push('Usage Summary (approved in period)')
    lines.push(
      [
        'Day Balance Used',
        'Full Day Count',
        'Full Day Days',
        'Half Day Count',
        'Half Day Days',
        'Short Leave Count',
        'Birthday Leave Count',
        'Work From Home Count',
        'Unpaid Count',
        'Total Requests',
      ]
        .map(csvEscape)
        .join(',')
    )
    lines.push(
      [
        usage.totalDayBalance,
        usage.fullDayCount,
        usage.fullDayDays,
        usage.halfDayCount,
        usage.halfDayDays,
        usage.shortLeaveCount,
        usage.birthdayLeaveCount,
        usage.workFromHomeCount,
        usage.unpaidCount,
        usage.totalRequests,
      ]
        .map(csvEscape)
        .join(',')
    )
    lines.push('')
    lines.push('Approved Leaves Detail')
    lines.push(
      [
        'Type',
        'Time Slot',
        'Start Date',
        'End Date',
        'Working Days',
        'Paid Days',
        'Unpaid Days',
        'Unpaid',
        'Status',
        'Reason',
      ]
        .map(csvEscape)
        .join(',')
    )
    for (const l of usage.leaves) {
      lines.push(
        [
          leaveTypeLabel(l.leaveType),
          l.timeSlot ? l.timeSlot.replace(/_/g, ' ') : '',
          istDateInputValue(l.startDate),
          istDateInputValue(l.endDate),
          l.days,
          l.paidDays,
          l.unpaidDays,
          l.unpaid ? 'Yes' : 'No',
          l.status,
          l.reason || '',
        ]
          .map(csvEscape)
          .join(',')
      )
    }

    const safeName = member.name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'employee'
    const filename = `leave-usage-${safeName}-${fromRaw}-to-${toRaw}.csv`
    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json({
    member,
    from: fromRaw,
    to: toRaw,
    balance: {
      year: balance.year,
      accrued: balance.accrued,
      used: balance.used,
      available,
      shortLeaves: balance.shortLeaves,
    },
    usage,
  })
}
