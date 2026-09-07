'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deriveInitials, type Branding } from '@/lib/branding'

export default function CompanyProfileTab({
  initialBranding,
  canEdit,
}: {
  initialBranding: Branding
  canEdit: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(initialBranding.name)
  const [initials, setInitials] = useState(initialBranding.initials)
  const [tagline, setTagline] = useState(initialBranding.tagline)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, initials, tagline }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      setName(data.name)
      setInitials(data.initials)
      setTagline(data.tagline)
      setMessage({ type: 'success', text: 'Company profile updated.' })
      router.refresh()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-1">Company Profile</h2>
      <p className="text-sm text-gray-500 mb-6">
        This name appears in the navigation bar, login screen, and browser tab.
      </p>

      <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-xs font-bold text-white shrink-0">
          {initials || deriveInitials(name)}
        </span>
        <div>
          <div className="font-semibold text-gray-900">{name || 'Company name'}</div>
          <div className="text-xs text-gray-500">{tagline || 'Tagline'}</div>
        </div>
      </div>

      {canEdit ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Company name</label>
            <input
              className="input"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (!initials || initials === deriveInitials(name)) {
                  setInitials(deriveInitials(e.target.value))
                }
              }}
              placeholder="KeyMouse IT"
              required
            />
          </div>
          <div>
            <label className="label">Logo initials</label>
            <input
              className="input max-w-[8rem]"
              value={initials}
              onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="KI"
              maxLength={3}
            />
            <p className="text-xs text-gray-400 mt-1">Shown in the square logo mark (2–3 letters).</p>
          </div>
          <div>
            <label className="label">Tagline</label>
            <input
              className="input"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="Internal operations platform"
            />
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-500">Only founders can edit company branding.</p>
      )}
    </div>
  )
}
