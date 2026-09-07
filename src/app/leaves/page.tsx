import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfYear, endOfYear, startOfMonth, endOfMonth, format } from 'date-fns'
import LeaveDashboardClient from './LeaveDashboardClient'

export const dynamic = 'force-dynamic'

export default async function LeavesPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const member = await prisma.teamMember.findUnique({
    where: { id: session.user.id },
  })

  if (!member) return null

  const isAdmin = ['Founder', 'Manager', 'HR'].includes(member.role)
  const currentYear = new Date().getFullYear()

  // Fetch standard employee data
  const myLeaves = await prisma.leaveRequest.findMany({
    where: { memberId: member.id },
    orderBy: { startDate: 'desc' },
  })

  const myBalance = await prisma.leaveBalance.findUnique({
    where: { memberId_year: { memberId: member.id, year: currentYear } }
  })

  let accrued = myBalance?.accrued || 0
  const used = myBalance?.used || 0
  
  // Calculate accrued dynamically if not explicitly stored (1 per month since Jan 1st)
  // Leaves carry forward each month.
  if (accrued === 0) {
     const currentMonth = new Date().getMonth() + 1 // 1-based
     accrued = currentMonth // e.g. August = 8 leaves accrued so far this year
  }

  // Fetch admin data if admin
  let allPendingLeaves: any[] = []
  let allMembers: any[] = []
  let allLeaves: any[] = []
  
  if (isAdmin) {
    allPendingLeaves = await prisma.leaveRequest.findMany({
      where: { status: 'pending' },
      include: { member: { select: { name: true, id: true } } },
      orderBy: { appliedAt: 'asc' },
    })
    allMembers = await prisma.teamMember.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true }
    })
    allLeaves = await prisma.leaveRequest.findMany({
      include: { member: { select: { name: true } } },
      orderBy: { startDate: 'desc' }
    })
  }

  return (
    <LeaveDashboardClient
      memberId={member.id}
      isAdmin={isAdmin}
      myLeaves={myLeaves}
      accrued={accrued}
      used={used}
      allPendingLeaves={allPendingLeaves}
      allMembers={allMembers}
      allLeaves={allLeaves}
    />
  )
}
