import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AuditLogClient from './AuditLogClient'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage() {
  const session = await auth()
  const userRole = session?.user?.role

  // Only Founder can access audit logs
  if (!userRole || userRole !== 'Founder') {
    redirect('/')
  }

  // Fetch team members for filter dropdown
  const members = await prisma.teamMember.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  return <AuditLogClient members={members} />
}
