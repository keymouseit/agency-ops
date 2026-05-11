import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth()
  const userRole = session?.user?.role

  // Only Founder and Manager can access Settings
  if (!userRole || !['Founder', 'Manager'].includes(userRole)) {
    redirect('/')
  }

  // Fetch team members
  const members = await prisma.teamMember.findMany({
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
  })

  return <SettingsClient members={members} />
}
