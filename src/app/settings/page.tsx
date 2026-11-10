import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getBranding } from '@/lib/branding'
import { listNotificationEmailGroups } from '@/lib/notification-emails'
import { listDailyTaskTypes } from '@/lib/daily-task-types'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import { canEditTeam } from '@/lib/team-permissions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { tab?: string }
}) {
  const session = await auth()
  const userRole = session?.user?.role

  // Founder / Manager / HR can access Settings (HR: team view; branding edit stays Founder-only)
  if (!userRole || !['Founder', 'Manager', 'HR'].includes(userRole)) {
    redirect('/')
  }
  // HR only gets the Team members tab — other tabs' data is never loaded or sent.
  const teamOnly = userRole === 'HR'

  // Fetch team members
  const members = await prisma.teamMember.findMany({
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
  })

  if (teamOnly) {
    return (
      <SettingsClient
        members={members}
        teamOnly
        viewerRole={userRole}
        canEditBranding={false}
        canManageTeam={canEditTeam(userRole)}
        initialTab="team"
      />
    )
  }

  const branding = await getBranding()
  const [notificationGroups, dailyTaskTypes] = await Promise.all([
    listNotificationEmailGroups(),
    listDailyTaskTypes(),
  ])

  return (
    <SettingsClient
      members={members}
      viewerRole={userRole}
      branding={branding}
      canEditBranding={userRole === 'Founder'}
      canManageTeam={canEditTeam(userRole)}
      notificationGroups={notificationGroups}
      dailyTaskTypes={dailyTaskTypes}
      initialTab={searchParams?.tab}
    />
  )
}
