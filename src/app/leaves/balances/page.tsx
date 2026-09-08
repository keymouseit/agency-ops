import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import LeaveBalancesClient from './LeaveBalancesClient'
import { syncShortLeaveBalance } from '@/lib/leave-balance'
import { sortByEmployeeNo } from '@/lib/employee-order'

export const dynamic = 'force-dynamic'

export default async function LeaveBalancesPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const member = await prisma.teamMember.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })

  if (!member) return null
  if (!['Founder', 'HR'].includes(member.role)) {
    redirect('/leaves')
  }

  const year = new Date().getFullYear()

  const members = sortByEmployeeNo(
    await prisma.teamMember.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })
  )

  const rows: {
    memberId: string
    name: string
    email: string
    role: string
    accrued: number
    used: number
  }[] = []
  for (const m of members) {
    const bal = await syncShortLeaveBalance(m.id, year)
    rows.push({
      memberId: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      accrued: bal.accrued,
      used: bal.used,
    })
  }

  return <LeaveBalancesClient year={year} rows={rows} />
}
