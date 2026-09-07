import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import LeaveUsageClient from './LeaveUsageClient'

export const dynamic = 'force-dynamic'

export default async function LeaveUsagePage() {
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

  const employees = await prisma.teamMember.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })

  return <LeaveUsageClient employees={employees} />
}
