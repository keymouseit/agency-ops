'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from '@/lib/campaigns'
import {
  validateCampaignDates,
  validateCampaignName,
  validateRequiredSelect,
} from '@/lib/validation'
import { FormLabel } from '@/components/FormLabel'

type FieldErrors = {
  name?: string
  channel?: string
  status?: string
  startDate?: string
  endDate?: string
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-600 mt-1">{message}</p>
}

export default function CampaignForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const router = useRouter()

  function validateForm(data: Record<string, FormDataEntryValue>): string | null {
    const errors: FieldErrors = {}
    const name = String(data.name ?? '')
    const channel = String(data.channel ?? '')
    const status = String(data.status ?? '')
    const startDate = String(data.startDate ?? '')
    const endDate = String(data.endDate ?? '')

    const nameError = validateCampaignName(name)
    if (nameError) errors.name = nameError

    const channelError = validateRequiredSelect(channel, 'Channel')
    if (channelError) errors.channel = channelError

    const statusError = validateRequiredSelect(status, 'Status')
    if (statusError) errors.status = statusError

    const dateError = validateCampaignDates(startDate, endDate)
    if (dateError) {
      if (dateError.toLowerCase().includes('start')) {
        errors.startDate = dateError
      } else {
        errors.endDate = dateError
      }
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      return Object.values(errors)[0] ?? 'Please fix the errors below.'
    }
    return null
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})

    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd.entries())
    const validationError = validateForm(data)
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    setLoading(false)
    if (!res.ok) {
      const resData = await res.json().catch(() => ({}))
      setError(resData.error ?? 'Failed to create campaign.')
      return
    }

    const created = await res.json()
    router.push(`/campaigns/${created.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4 max-w-2xl" noValidate>
      <div>
        <FormLabel required>Campaign name</FormLabel>
        <input
          name="name"
          required
          minLength={2}
          className={`input ${fieldErrors.name ? 'border-red-300 focus:border-red-400' : ''}`}
          placeholder="e.g. FinTech founders — LinkedIn outreach Q3"
        />
        <FieldError message={fieldErrors.name} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <FormLabel required>Channel</FormLabel>
          <select
            name="channel"
            required
            className={`input ${fieldErrors.channel ? 'border-red-300 focus:border-red-400' : ''}`}
            defaultValue="LinkedIn"
          >
            {CAMPAIGN_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <FieldError message={fieldErrors.channel} />
        </div>
        <div>
          <FormLabel required>Status</FormLabel>
          <select
            name="status"
            required
            className={`input ${fieldErrors.status ? 'border-red-300 focus:border-red-400' : ''}`}
            defaultValue="active"
          >
            {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <FieldError message={fieldErrors.status} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <FormLabel required>Start date</FormLabel>
          <input
            name="startDate"
            type="date"
            required
            className={`input ${fieldErrors.startDate ? 'border-red-300 focus:border-red-400' : ''}`}
          />
          <FieldError message={fieldErrors.startDate} />
        </div>
        <div>
          <FormLabel required>End date</FormLabel>
          <input
            name="endDate"
            type="date"
            required
            className={`input ${fieldErrors.endDate ? 'border-red-300 focus:border-red-400' : ''}`}
          />
          <FieldError message={fieldErrors.endDate} />
          <p className="text-xs text-gray-400 mt-1">Must be on or after the start date.</p>
        </div>
      </div>
      <div>
        <FormLabel>Objective</FormLabel>
        <textarea
          name="objective"
          rows={3}
          className="input"
          placeholder="Who are we targeting and what is the goal?"
        />
      </div>
      <div>
        <FormLabel>Notes</FormLabel>
        <textarea name="notes" rows={3} className="input" placeholder="Messaging angle, ICP, budget, etc." />
      </div>
      {error && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : 'Create campaign'}
        </button>
        <Link href="/campaigns" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  )
}
