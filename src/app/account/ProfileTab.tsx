'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'

type Member = {
  id: string
  name: string
  email: string
  role: string
}

export default function ProfileTab({ member, onSave }: { member: Member; onSave?: () => void }) {
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const { update } = useSession()

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      // Update session with new data to refresh header
      await update({ name, email })

      setMessage({ type: 'success', text: 'Profile updated successfully' })

      // Trigger audit log refresh
      onSave?.()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = name !== member.name || email !== member.email

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4">Personal Information</h2>

      <div className="space-y-4 max-w-md">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="Enter your full name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
            placeholder="Enter your email"
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">
            Changing your email will require verification
          </p>
        </div>

        {/* Role (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <input
            type="text"
            value={member.role}
            disabled
            className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            Contact your administrator to change your role
          </p>
        </div>

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
        <div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
