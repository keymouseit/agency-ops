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
  notificationGroups,
  dailyTaskTypes,
  initialTab,
}: {
  members: Member[]
  branding: Branding
  canEditBranding: boolean
  notificationGroups: NotificationGroup[]
  dailyTaskTypes: DailyTaskTypeRecord[]
  initialTab?: string
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromParam(initialTab))

  function selectTab(id: SettingsTab) {
    setActiveTab(id)
    router.replace(id === 'team' ? '/settings' : `/settings?tab=${id}`, { scroll: false })
  }

  const tabs = [
    { id: 'team' as const, label: 'Team Members', icon: '👥' },
    { id: 'company' as const, label: 'Company Profile', icon: '🏢' },
    { id: 'notifications' as const, label: 'Notifications', icon: '🔔' },
    { id: 'types' as const, label: 'Task types', icon: '⚙️' },
  ]

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage team members, company profile, notifications, and daily task types
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'team' && <TeamMembersTab members={members} />}

        {activeTab === 'company' && (
          <CompanyProfileTab initialBranding={branding} canEdit={canEditBranding} />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab initialGroups={notificationGroups} canEdit={canEditBranding} />
        )}

        {activeTab === 'types' && (
          <DailyTaskTypesTab initialTypes={dailyTaskTypes} canEdit={canEditBranding} />
        )}
      </div>
    </div>
  )
}
