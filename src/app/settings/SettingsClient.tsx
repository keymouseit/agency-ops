'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Branding } from '@/lib/branding'
import CompanyProfileTab from './CompanyProfileTab'
import TeamMembersTab from './TeamMembersTab'
import NotificationsTab from './NotificationsTab'
import DailyTaskTypesTab from './DailyTaskTypesTab'

type Member = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: Date
  birthday?: Date | string | null
  designation?: string | null
  joiningDate?: Date | string | null
}

type NotificationGroup = {
  purpose: 'leave_applied' | 'leave_decision' | 'leave_calendar'
  label: string
  description: string
  emails: string[]
}

type DailyTaskTypeRecord = {
  value: string
  label: string
  groupLabel: string
  roles: string[]
}

type SettingsTab = 'team' | 'company' | 'notifications' | 'types'

function tabFromParam(tab?: string): SettingsTab {
  if (tab === 'company' || tab === 'notifications' || tab === 'types') return tab
  if (tab === 'workflow') return 'types'
  return 'team'
}

export default function SettingsClient({
  members,
  branding,
  canEditBranding,
  canManageTeam = true,
  notificationGroups = [],
  dailyTaskTypes = [],
  initialTab,
  teamOnly = false,
  viewerRole,
}: {
  members: Member[]
  /** Omitted when `teamOnly` (HR) — the company tab is not rendered. */
  branding?: Branding
  canEditBranding: boolean
  canManageTeam?: boolean
  notificationGroups?: NotificationGroup[]
  dailyTaskTypes?: DailyTaskTypeRecord[]
  initialTab?: string
  /** HR: only the Team members tab is shown (other tabs' data is not loaded server-side). */
  teamOnly?: boolean
  viewerRole?: string
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    teamOnly ? 'team' : tabFromParam(initialTab)
  )

  function selectTab(id: SettingsTab) {
    setActiveTab(id)
    router.replace(id === 'team' ? '/settings' : `/settings?tab=${id}`, { scroll: false })
  }

  const allTabs = [
    { id: 'team' as const, label: 'Team Members', shortLabel: 'Team', icon: '👥' },
    { id: 'company' as const, label: 'Company Profile', shortLabel: 'Company', icon: '🏢' },
    { id: 'notifications' as const, label: 'Notifications', shortLabel: 'Alerts', icon: '🔔' },
    { id: 'types' as const, label: 'Task types', shortLabel: 'Tasks', icon: '⚙️' },
  ]
  const tabs = teamOnly ? allTabs.filter(t => t.id === 'team') : allTabs

  return (
    <div className="w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {teamOnly ? 'Employee profiles' : 'Settings'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {teamOnly
            ? 'Manage employee profiles, designations, birthdays, and joining dates'
            : 'Manage team members, company profile, notifications, and daily task types'}
        </p>
      </div>

      {/* Tabs — equal columns on mobile so icons/labels stay aligned */}
      {tabs.length > 1 && (
      <div className="border-b border-gray-200 mb-6">
        <div className="grid grid-cols-4 gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 px-1 py-2.5 sm:flex-row sm:gap-2 sm:px-3 text-[11px] sm:text-sm font-medium transition-colors border-b-2 min-w-0 ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-base sm:text-sm leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span className="text-center leading-tight whitespace-nowrap truncate max-w-full">
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Tab Content */}
      <div>
        {activeTab === 'team' && (
          <TeamMembersTab members={members} canManage={canManageTeam} viewerRole={viewerRole} />
        )}

        {!teamOnly && activeTab === 'company' && branding && (
          <CompanyProfileTab initialBranding={branding} canEdit={canEditBranding} />
        )}

        {!teamOnly && activeTab === 'notifications' && (
          <NotificationsTab initialGroups={notificationGroups} canEdit={canEditBranding} />
        )}

        {!teamOnly && activeTab === 'types' && (
          <DailyTaskTypesTab initialTypes={dailyTaskTypes} canEdit={canEditBranding} />
        )}
      </div>
    </div>
  )
}
