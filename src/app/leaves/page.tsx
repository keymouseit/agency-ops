import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import LeaveDashboardClient from './LeaveDashboardClient'
import { syncShortLeaveBalance } from '@/lib/leave-balance'

export const dynamic = 'force-dynamic'

export default async function LeavesPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const member = await prisma.teamMember.findUnique({
    where: { id: session.user.id },
  })

  if (!member) return null

  const isAdmin = ['Founder', 'Manager', 'HR'].includes(member.role)
  const canManageBalances = ['Founder', 'HR'].includes(member.role)
  const currentYear = new Date().getFullYear()

  const myLeaves = await prisma.leaveRequest.findMany({
    where: { memberId: member.id },
    orderBy: { startDate: 'desc' },
  })

  const balance = await syncShortLeaveBalance(member.id, currentYear)

  let accrued = balance.accrued || 0
  const used = balance.used || 0
  const shortLeaves = balance.shortLeaves || 0

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
      select: { id: true, name: true, role: true },
    })
    allLeaves = await prisma.leaveRequest.findMany({
      include: { member: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
    })
  }

  return (
    <LeaveDashboardClient
      memberId={member.id}
      isAdmin={isAdmin}
      canManageBalances={canManageBalances}
      myLeaves={myLeaves}
      accrued={accrued}
      used={used}
      shortLeaves={shortLeaves}
      allPendingLeaves={allPendingLeaves}
      allMembers={allMembers}
      allLeaves={allLeaves}
    />
  )
}
