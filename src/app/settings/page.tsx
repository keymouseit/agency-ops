import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getBranding } from '@/lib/branding'
import { listNotificationEmailGroups } from '@/lib/notification-emails'
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

  const branding = await getBranding()
  const notificationGroups = await listNotificationEmailGroups()

  return (
    <SettingsClient
      members={members}
      branding={branding}
      canEditBranding={userRole === 'Founder'}
      notificationGroups={notificationGroups}
    />
  )
}
