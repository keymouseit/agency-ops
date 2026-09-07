import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, checkRole } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { syncShortLeaveBalance } from '@/lib/leave-balance'

export async function GET() {
  const deny = await checkRole(['Founder', 'HR'])
  if (deny) return deny

  const year = new Date().getFullYear()

  const members = await prisma.teamMember.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  })

  const rows: {
    memberId: string
    name: string
    email: string
    role: string
    year: number
    accrued: number
    used: number
    available: number
    balanceId: string
  }[] = []
  for (const m of members) {
    const bal = await syncShortLeaveBalance(m.id, year)
    rows.push({
      memberId: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      year,
      accrued: bal.accrued,
      used: bal.used,
      available: Math.max(0, Number((bal.accrued - bal.used).toFixed(2))),
      balanceId: bal.id,
    })
  }

  return NextResponse.json({ year, rows })
}

export async function PUT(req: Request) {
  const deny = await checkRole(['Founder', 'HR'])
  if (deny) return deny

  const session = await auth()
  const body = await req.json()
  const { memberId, year: yearInput, accrued, used } = body

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const year = typeof yearInput === 'number' ? yearInput : new Date().getFullYear()
  const accruedNum = Number(accrued)
  const usedNum = Number(used)

  if (!Number.isFinite(accruedNum) || accruedNum < 0 || accruedNum > 24) {
    return NextResponse.json({ error: 'Accrued must be a number between 0 and 24' }, { status: 400 })
  }
  if (!Number.isFinite(usedNum) || usedNum < 0 || usedNum > 24) {
    return NextResponse.json({ error: 'Used must be a number between 0 and 24' }, { status: 400 })
  }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, active: true },
  })
  if (!member || !member.active) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  const existing = await prisma.leaveBalance.findUnique({
    where: { memberId_year: { memberId, year } },
  })

  const balance = await prisma.leaveBalance.upsert({
    where: { memberId_year: { memberId, year } },
    create: { memberId, year, accrued: accruedNum, used: usedNum },
    update: { accrued: accruedNum, used: usedNum },
  })

  await logAudit({
    action: 'updated',
    entityType: 'LeaveBalance',
    entityId: balance.id,
    entityName: `${member.name} ${year} leave balance`,
    changes: {
      accrued: { old: existing?.accrued ?? null, new: accruedNum },
      used: { old: existing?.used ?? null, new: usedNum },
    },
    metadata: { memberId, year, updatedBy: session?.user?.id },
    ipAddress: getClientIP(req),
  })

  return NextResponse.json({
    ...balance,
    available: Math.max(0, balance.accrued - balance.used),
  })
}
