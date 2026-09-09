'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type NotificationPurpose = 'leave_applied' | 'leave_decision' | 'leave_calendar'

type Group = {
  purpose: NotificationPurpose
  label: string
  description: string
  emails: string[]
}

const EMPTY_GROUPS: Group[] = [
  {
    purpose: 'leave_applied',
    label: 'New leave applications',
    description: 'These people get an email when someone applies for leave.',
    emails: [],
  },
  {
    purpose: 'leave_decision',
    label: 'Leave approved or rejected',
    description:
      'These people are copied when a leave is approved or rejected. The employee always gets the email too.',
    emails: [],
  },
  {
    purpose: 'leave_calendar',
    label: 'Leave calendar',
    description:
      'Approved leaves are added to these Google Calendar emails. Cancelled leaves are removed from the same list.',
    emails: [],
  },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NotificationsTab({
  initialGroups,
  canEdit,
}: {
  initialGroups: Group[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [groups, setGroups] = useState(initialGroups.length ? initialGroups : EMPTY_GROUPS)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function save(purpose: NotificationPurpose, emails: string[]) {
    setSaving(purpose)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/notification-emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, emails }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setGroups(prev => prev.map(group => (group.purpose === purpose ? { ...group, emails: data.emails } : group)))
      setMessage({ type: 'success', text: 'Notification emails updated.' })
      router.refresh()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save',
      })
    } finally {
      setSaving(null)
    }
  }

  function addEmail(purpose: NotificationPurpose) {
    const value = (drafts[purpose] || '').trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setMessage({ type: 'error', text: 'Enter a valid email address.' })
      return
    }
    const group = groups.find(item => item.purpose === purpose)
    if (!group) return
    if (group.emails.includes(value)) {
      setMessage({ type: 'error', text: 'That email is already on this list.' })
      return
    }
    setDrafts(prev => ({ ...prev, [purpose]: '' }))
    void save(purpose, [...group.emails, value])
  }

  function removeEmail(purpose: NotificationPurpose, email: string) {
    const group = groups.find(item => item.purpose === purpose)
    if (!group) return
    void save(purpose, group.emails.filter(item => item !== email))
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Notification emails</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add or remove who gets leave emails and calendar invites. The employee who applied still always
          gets approve/reject emails.
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {groups.map(group => (
        <div key={group.purpose} className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">{group.description}</p>

          <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
            {group.emails.length ? (
              group.emails.map(email => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-800"
                >
                  {email}
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => removeEmail(group.purpose, email)}
                      disabled={saving === group.purpose}
                      aria-label={`Remove ${email}`}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))
            ) : (
              <p className="text-sm text-gray-400">No emails yet.</p>
            )}
          </div>

          {canEdit ? (
            <form
              className="flex gap-2"
              onSubmit={e => {
                e.preventDefault()
                addEmail(group.purpose)
              }}
            >
              <input
                type="email"
                className="input flex-1"
                placeholder="name@company.com"
                value={drafts[group.purpose] || ''}
                onChange={e => setDrafts(prev => ({ ...prev, [group.purpose]: e.target.value }))}
                disabled={saving === group.purpose}
              />
              <button type="submit" className="btn-primary shrink-0" disabled={saving === group.purpose}>
                {saving === group.purpose ? '...' : 'Add'}
              </button>
            </form>
          ) : (
            <p className="text-xs text-gray-400">Only a Founder can change these lists.</p>
          )}
        </div>
      ))}
    </div>
  )
}
