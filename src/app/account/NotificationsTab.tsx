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

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: () => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-gray-900' : 'bg-gray-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
        body: JSON.stringify(preferences),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update preferences')
      }

      setMessage({ type: 'success', text: 'Notification preferences updated successfully' })
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update preferences',
      })
    } finally {
      setSaving(false)
    }
  }

  function togglePreference(key: keyof NotificationPreferences) {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const sections = [
    {
      icon: '📁',
      title: 'Project & estimates',
      description: 'Assignments and estimate workflow',
      items: [
        { key: 'projectAssigned' as const, label: 'Project assigned to you' },
        { key: 'estimateRequested' as const, label: 'Estimate requested from you' },
        { key: 'estimateNeedsReview' as const, label: 'Estimate ready for your review' },
      ],
    },
    {
      icon: '🔍',
      title: 'QA & delivery',
      description: 'Test cycles and release sign-off',
      items: [
        { key: 'qaTestFailed' as const, label: 'QA test cycle failed' },
        { key: 'qaTestPassed' as const, label: 'QA test cycle passed' },
        { key: 'releaseSignedOff' as const, label: 'Release signed off — ready to deliver' },
      ],
    },
    {
      icon: '⏰',
      title: 'Deadlines & reminders',
      description: 'Daily ops and weekly check-ins',
      items: [
        {
          key: 'deadlineApproaching' as const,
          label: 'Deadline approaching',
          description: '24-hour warning before due dates',
        },
        { key: 'missingEOD' as const, label: 'Missing EOD reminder' },
        { key: 'missingMorningPlan' as const, label: 'Missing morning plan reminder' },
        { key: 'weeklyCheckInDue' as const, label: 'Weekly check-in due (Monday)' },
      ],
    },
  ]

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
          Loading preferences...
        </div>
      </div>
    )
  }

  const enabledCount = Object.values(preferences).filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm">
                🔔
              </span>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Notification preferences</h2>
                <p className="text-xs text-gray-500">
                  {enabledCount} of {Object.keys(preferences).length} enabled · in-app bell only
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {sections.map((section, index) => (
            <div
              key={section.title}
              className={`rounded-xl border border-gray-200 overflow-hidden ${
                index > 0 ? '' : ''
              }`}
            >
              <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-base" aria-hidden>
                    {section.icon}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
                    <p className="text-xs text-gray-500">{section.description}</p>
                  </div>
                </div>
              </div>
              <div className="px-4 divide-y divide-gray-100">
                {section.items.map(item => (
                  <Toggle
                    key={item.key}
                    checked={preferences[item.key]}
                    onChange={() => togglePreference(item.key)}
                    label={item.label}
                    description={'description' in item ? item.description : undefined}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
            <span className="font-semibold">Note:</span> Notifications appear in the bell icon in the header.
            Email and push notifications are coming soon.
          </div>

          {message && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              <span aria-hidden>{message.type === 'success' ? '✓' : '⚠'}</span>
              {message.text}
            </div>
          )}

          <div className="flex justify-end pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
