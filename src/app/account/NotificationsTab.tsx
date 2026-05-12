'use client'
import { useState, useEffect } from 'react'

type NotificationPreferences = {
  projectAssigned: boolean
  estimateRequested: boolean
  estimateNeedsReview: boolean
  qaTestFailed: boolean
  qaTestPassed: boolean
  releaseSignedOff: boolean
  deadlineApproaching: boolean
  missingEOD: boolean
  missingMorningPlan: boolean
  weeklyCheckInDue: boolean
}

export default function NotificationsTab({ memberId }: { memberId: string }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    projectAssigned: true,
    estimateRequested: true,
    estimateNeedsReview: true,
    qaTestFailed: true,
    qaTestPassed: true,
    releaseSignedOff: true,
    deadlineApproaching: true,
    missingEOD: true,
    missingMorningPlan: true,
    weeklyCheckInDue: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadPreferences()
  }, [])

  async function loadPreferences() {
    try {
      const res = await fetch('/api/account/notifications')
      if (res.ok) {
        const data = await res.json()
        if (data.preferences) {
          setPreferences(data.preferences)
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update preferences')
      }

      setMessage({ type: 'success', text: 'Notification preferences updated successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  function togglePreference(key: keyof NotificationPreferences) {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="text-sm text-gray-500">Loading preferences...</div>
      </div>
    )
  }

  const sections = [
    {
      title: 'Project & Estimate Notifications',
      items: [
        { key: 'projectAssigned' as const, label: 'Project assigned to you' },
        { key: 'estimateRequested' as const, label: 'Estimate requested from you' },
        { key: 'estimateNeedsReview' as const, label: 'Estimate ready for your review' },
      ]
    },
    {
      title: 'QA & Delivery Notifications',
      items: [
        { key: 'qaTestFailed' as const, label: 'QA test cycle failed' },
        { key: 'qaTestPassed' as const, label: 'QA test cycle passed' },
        { key: 'releaseSignedOff' as const, label: 'Release signed off - ready to deliver' },
      ]
    },
    {
      title: 'Deadline & Reminder Notifications',
      items: [
        { key: 'deadlineApproaching' as const, label: 'Deadline approaching (24h warning)' },
        { key: 'missingEOD' as const, label: 'Missing EOD reminder' },
        { key: 'missingMorningPlan' as const, label: 'Missing morning plan reminder' },
        { key: 'weeklyCheckInDue' as const, label: 'Weekly check-in due (Monday)' },
      ]
    }
  ]

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-1">Your Notification Preferences</h2>
      <p className="text-sm text-gray-500 mb-6">
        Choose which notifications you want to receive in the app
      </p>

      <div className="space-y-6">
        {sections.map(section => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {section.title}
            </h3>
            <div className="space-y-2 pl-1">
              {section.items.map(item => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={preferences[item.key]}
                    onChange={() => togglePreference(item.key)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        {/* Info Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Notifications will appear in the notification bell in the top navigation bar.
            Email and push notifications are coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
