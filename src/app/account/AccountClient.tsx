'use client'

import { useState } from 'react'
import ProfileTab from './ProfileTab'
import SecurityTab from './SecurityTab'
import NotificationsTab from './NotificationsTab'
import EntityAuditTrail from '@/components/EntityAuditTrail'
import { ROLE_COLORS } from '@/lib/utils'

type Member = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: Date
}

const TABS = [
  { id: 'profile' as const, label: 'Profile', icon: '👤' },
  { id: 'notifications' as const, label: 'Notifications', icon: '🔔' },
]

export default function AccountClient({ member }: { member: Member }) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)
  const roleCls = ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-700'
  const initials = member.name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="w-full mx-auto space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-4 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white shrink-0">
              {initials}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Account settings</h1>
              <p className="text-sm text-gray-500 truncate">{member.email}</p>
              <span className={`inline-flex mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${roleCls}`}>
                {member.role === 'SocialMedia' ? 'Social Media' : member.role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200 self-start sm:self-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="text-sm" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {activeTab === 'profile' && (
          <ProfileTab member={member} onSave={() => setAuditRefreshKey(prev => prev + 1)} />
        )}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'notifications' && <NotificationsTab memberId={member.id} />}
      </div>

      <EntityAuditTrail
        entityType="TeamMember"
        entityId={member.id}
        title="Account activity"
        refreshKey={auditRefreshKey}
      />
    </div>
  )
}
