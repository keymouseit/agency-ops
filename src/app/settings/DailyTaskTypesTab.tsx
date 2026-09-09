'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES } from '@/lib/utils'

type DailyTaskTypeRecord = {
  value: string
  label: string
  groupLabel: string
  roles: string[]
}

export default function DailyTaskTypesTab({
  initialTypes,
  canEdit,
}: {
  initialTypes: DailyTaskTypeRecord[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [types, setTypes] = useState(initialTypes)
  const [role, setRole] = useState<(typeof ROLES)[number]>('Dev')
  const [label, setLabel] = useState('')
  const [groupLabel, setGroupLabel] = useState('')
  const [customGroup, setCustomGroup] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const groupLabels = useMemo(
    () => [...new Set(types.map(type => type.groupLabel))].sort(),
    [types],
  )
  const roleTypes = types.filter(type => type.roles.includes(role))
  const grouped = groupLabels
    .map(group => ({
      group,
      types: roleTypes.filter(type => type.groupLabel === group),
    }))
    .filter(item => item.types.length)
  const availableToAdd = groupLabels
    .map(group => ({
      group,
      types: types.filter(type => type.groupLabel === group && !type.roles.includes(role)),
    }))
    .filter(item => item.types.length)

  async function applyCatalog(res: Response) {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    if (Array.isArray(data.types)) setTypes(data.types)
    router.refresh()
  }

  async function addExisting(type: DailyTaskTypeRecord) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/daily-task-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          label: type.label,
          groupLabel: type.groupLabel,
          value: type.value,
        }),
      })
      await applyCatalog(res)
      setMessage({ type: 'success', text: `Added ${type.label} for ${role}.` })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add type' })
    } finally {
      setSaving(false)
    }
  }

  async function addType(e: React.FormEvent) {
    e.preventDefault()
    const nextGroup = groupLabel === '__new__' ? customGroup.trim() : groupLabel.trim()
    if (!label.trim() || !nextGroup) {
      setMessage({ type: 'error', text: 'Enter a type name and group.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/daily-task-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, label: label.trim(), groupLabel: nextGroup }),
      })
      await applyCatalog(res)
      setLabel('')
      setCustomGroup('')
      setMessage({ type: 'success', text: `Added for ${role}.` })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add type' })
    } finally {
      setSaving(false)
    }
  }

  async function removeType(value: string) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/daily-task-types', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, value }),
      })
      await applyCatalog(res)
      setMessage({ type: 'success', text: `Removed from ${role}.` })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove type' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Daily task types</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose a role, then add or remove the types people see in the morning plan dropdown.
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

      <div className="flex flex-wrap gap-2">
        {ROLES.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setRole(item)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              role === item
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Types for {role}</h3>
        {grouped.length ? (
          grouped.map(item => (
            <div key={item.group}>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{item.group}</p>
              <div className="flex flex-wrap gap-2">
                {item.types.map(type => (
                  <span
                    key={type.value}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-800"
                  >
                    {type.label}
                    {canEdit ? (
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => removeType(type.value)}
                        disabled={saving}
                        aria-label={`Remove ${type.label}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">No types for this role yet.</p>
        )}
      </div>

      {canEdit && availableToAdd.length ? (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Add existing type to {role}</h3>
          {availableToAdd.map(item => (
            <div key={item.group}>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{item.group}</p>
              <div className="flex flex-wrap gap-2">
                {item.types.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    disabled={saving}
                    onClick={() => addExisting(type)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:opacity-50"
                  >
                    <span className="text-gray-400">+</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {canEdit ? (
        <form onSubmit={addType} className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Create new type for {role}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Type name</label>
              <input
                className="input"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Payroll"
              />
            </div>
            <div>
              <label className="label">Group</label>
              <select
                className="input"
                value={groupLabel}
                onChange={e => setGroupLabel(e.target.value)}
              >
                <option value="">Select group</option>
                {groupLabels.map(group => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
                <option value="__new__">New group…</option>
              </select>
            </div>
          </div>
          {groupLabel === '__new__' ? (
            <div>
              <label className="label">New group name</label>
              <input
                className="input"
                value={customGroup}
                onChange={e => setCustomGroup(e.target.value)}
                placeholder="e.g. Finance"
              />
            </div>
          ) : null}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : `Add to ${role}`}
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-400">Only a Founder can change these types.</p>
      )}
    </div>
  )
}
