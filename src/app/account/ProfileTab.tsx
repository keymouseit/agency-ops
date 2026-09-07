'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { ROLE_COLORS } from '@/lib/utils'

type Member = {
  id: string
  name: string
  email: string
  role: string
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 mt-1.5">{children}</p>
}

export default function ProfileTab({ member, onSave }: { member: Member; onSave?: () => void }) {
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const { update } = useSession()
  const roleCls = ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-700'

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      await update({ name, email })
      setMessage({ type: 'success', text: 'Profile updated successfully' })
      onSave?.()
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update profile',
      })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = name !== member.name || email !== member.email

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm">
            👤
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Personal information</h2>
            <p className="text-xs text-gray-500">Update your name and view account details</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input bg-gray-50/50 focus:bg-white"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="label">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input bg-gray-50/50 focus:bg-white"
              placeholder="Enter your email"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {member.role === 'SocialMedia' ? 'Social Media' : member.role}
              </p>
            </div>
            <span className={`badge text-[11px] ${roleCls}`}>
              {member.role === 'SocialMedia' ? 'Social Media' : member.role}
            </span>
          </div>
          <FieldHint>Contact your administrator to change your role</FieldHint>
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

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
