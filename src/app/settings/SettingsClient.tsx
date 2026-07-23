'use client'
import { useState } from 'react'
import TeamMembersTab from './TeamMembersTab'

type Member = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: Date
}

export default function SettingsClient({ members }: { members: Member[] }) {
  const [activeTab, setActiveTab] = useState<'team' | 'company' | 'notifications' | 'workflow'>('team')

  const tabs = [
    { id: 'team' as const, label: 'Team Members', icon: '👥' },
    { id: 'company' as const, label: 'Company Profile', icon: '🏢' },
    { id: 'notifications' as const, label: 'Notifications', icon: '🔔' },
    { id: 'workflow' as const, label: 'Workflow', icon: '⚙️' },
  ]

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage team members, company profile, notifications, and workflow preferences
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
        {activeTab === 'team' && <TeamMembersTab members={members} />}

        {activeTab === 'company' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Company Profile</h2>
            <p className="text-gray-500 text-sm">Company profile settings coming soon...</p>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
            <p className="text-gray-500 text-sm">Notification preferences coming soon...</p>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Workflow Customization</h2>
            <p className="text-gray-500 text-sm">Workflow customization coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}
