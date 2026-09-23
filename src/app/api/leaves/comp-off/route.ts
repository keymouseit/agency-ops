import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAvailableCompOffDays, syncShortLeaveBalance } from '@/lib/leave-balance'
import { istYearAndMonth } from '@/lib/ist'
import { revalidateLeavePages } from '@/lib/cache-tags'

export const dynamic = 'force-dynamic'

const HR_ROLES = ['Founder', 'HR']

/** List Comp Off balance + grants. Employees see own; HR/Founder can filter by memberId. */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isHr = HR_ROLES.includes(session.user.role || '')
    const requestedMemberId = searchParams.get('memberId')
    const memberId =
      isHr && requestedMemberId ? requestedMemberId : session.user.id

    if (!isHr && requestedMemberId && requestedMemberId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const year = istYearAndMonth().year
    const { balance, accrued, used, pending, available } = await getAvailableCompOffDays(
      memberId,
      year
    )

    const grants = await prisma.compOffGrant.findMany({
      where: { memberId },
      include: {
        grantedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      year,
      memberId,
      balanceId: balance.id,
      accrued,
      used,
      pending,
      available,
      grants,
    })
  } catch (error: unknown) {
    console.error('Error fetching Comp Off:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** HR/Founder only — assign Comp Off credit to an employee. */
export async function POST(request: Request) {
  const deny = await checkRole(HR_ROLES)
  if (deny) return deny

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    const body = await request.json()
    const { memberId, days, note, applicableFrom, applicableTo } = body

    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json({ error: 'Employee is required' }, { status: 400 })
    }

    const daysNum = Number(days)
    if (!Number.isFinite(daysNum) || daysNum <= 0 || daysNum > 30) {
      return NextResponse.json(
        { error: 'Duration must be a number between 0.5 and 30 days' },
        { status: 400 }
      )
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, active: true },
    })
    if (!member || !member.active) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    let fromDate: Date | null = null
    let toDate: Date | null = null
    if (applicableFrom) {
      fromDate = new Date(applicableFrom)
      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json({ error: 'Invalid applicable from date' }, { status: 400 })
      }
    }
    if (applicableTo) {
      toDate = new Date(applicableTo)
      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json({ error: 'Invalid applicable to date' }, { status: 400 })
      }
    }
    if (fromDate && toDate && toDate < fromDate) {
      return NextResponse.json(
        { error: 'Applicable end date must be on or after start date' },
        { status: 400 }
      )
    }

    const year = istYearAndMonth().year
    await syncShortLeaveBalance(memberId, year)

    const roundedDays = Number(daysNum.toFixed(2))

    const result = await prisma.$transaction(async tx => {
      const grant = await tx.compOffGrant.create({
        data: {
          memberId,
          days: roundedDays,
          applicableFrom: fromDate,
          applicableTo: toDate,
          note: typeof note === 'string' && note.trim() ? note.trim() : null,
          grantedById: session.user!.id,
        },
        include: {
          member: { select: { id: true, name: true } },
          grantedBy: { select: { id: true, name: true } },
        },
      })

      const balance = await tx.leaveBalance.upsert({
        where: { memberId_year: { memberId, year } },
        update: { compOffAccrued: { increment: roundedDays } },
        create: {
          memberId,
          year,
          accrued: 0,
          used: 0,
          compOffAccrued: roundedDays,
          compOffUsed: 0,
        },
      })

      return { grant, balance }
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'created',
        entityType: 'CompOffGrant',
        entityId: result.grant.id,
        entityName: `Comp Off for ${member.name}`,
        changes: JSON.stringify({
          days: roundedDays,
          memberId,
          applicableFrom: fromDate?.toISOString() ?? null,
          applicableTo: toDate?.toISOString() ?? null,
          note: result.grant.note,
        }),
      },
    })

    revalidateLeavePages()

    const available = await getAvailableCompOffDays(memberId, year)

    return NextResponse.json(
      {
        grant: result.grant,
        balance: {
          accrued: available.accrued,
          used: available.used,
          available: available.available,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Error assigning Comp Off:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
