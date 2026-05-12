'use client'
import { useState } from 'react'
import ProfileTab from './ProfileTab'
import SecurityTab from './SecurityTab'
import NotificationsTab from './NotificationsTab'

type Member = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: Date
}

export default function AccountClient({ member }: { member: Member }) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: '👤' },
    { id: 'security' as const, label: 'Security', icon: '🔒' },
    { id: 'notifications' as const, label: 'Notifications', icon: '🔔' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your personal profile, security, and notification preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'profile' && <ProfileTab member={member} />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'notifications' && <NotificationsTab memberId={member.id} />}
      </div>
    </div>
  )
}
