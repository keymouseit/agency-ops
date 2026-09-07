'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  isValidEmail,
  isValidPhone,
  validateLinkedInUrl,
  validateScheduledDateTime,
} from '@/lib/validation'
import { FormLabel } from '@/components/FormLabel'

type Props = {
  campaignId: string
  campaignName: string
  channel?: string
}

type FieldErrors = {
  scheduledDate?: string
  scheduledTime?: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  clientLinkedIn?: string
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-600 mt-1">{message}</p>
}

export default function ScheduleCallModal({ campaignId, campaignName, channel = 'LinkedIn' }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const router = useRouter()

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  function close() {
    setError('')
    setFieldErrors({})
    setOpen(false)
  }

  function validateForm(data: Record<string, FormDataEntryValue>): string | null {
    const errors: FieldErrors = {}
    const clientName = String(data.clientName ?? '').trim()
    const scheduledDate = String(data.scheduledDate ?? '')
    const scheduledTime = String(data.scheduledTime ?? '')
    const clientEmail = String(data.clientEmail ?? '')
    const clientPhone = String(data.clientPhone ?? '')
    const clientLinkedIn = String(data.clientLinkedIn ?? '')

    if (!clientName) {
      errors.clientName = 'Client name is required.'
    }

    const dateTimeError = validateScheduledDateTime(scheduledDate, scheduledTime)
    if (dateTimeError) {
      if (dateTimeError.toLowerCase().includes('time')) {
        errors.scheduledTime = dateTimeError
      } else {
        errors.scheduledDate = dateTimeError
      }
    }

    if (clientEmail.trim() && !isValidEmail(clientEmail)) {
      errors.clientEmail = 'Enter a valid email address.'
    }
    if (clientPhone.trim() && !isValidPhone(clientPhone)) {
      errors.clientPhone = 'Enter a valid phone number (7–15 digits).'
    }

    const linkedInError = validateLinkedInUrl(clientLinkedIn)
    if (linkedInError) errors.clientLinkedIn = linkedInError

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

    const res = await fetch(`/api/campaigns/${campaignId}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    setLoading(false)
    if (!res.ok) {
      const resData = await res.json().catch(() => ({}))
      setError(resData.error ?? 'Failed to schedule call.')
      return
    }

    close()
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        className="btn-primary inline-flex items-center gap-2"
        onClick={() => { setError(''); setFieldErrors({}); setOpen(true) }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Schedule call
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
            onClick={close}
            aria-label="Close"
          />

          <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm">
                      📞
                    </span>
                    <span className="badge bg-white/80 text-gray-600 border border-gray-200">{channel}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Schedule a call</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    From campaign <span className="font-medium text-gray-700">{campaignName}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5" noValidate>
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  When
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormLabel required>Date</FormLabel>
                    <input
                      name="scheduledDate"
                      type="date"
                      required
                      min={today}
                      defaultValue={today}
                      className={`input ${fieldErrors.scheduledDate ? 'border-red-300 focus:border-red-400' : ''}`}
                    />
                    <FieldError message={fieldErrors.scheduledDate} />
                  </div>
                  <div>
                    <FormLabel required>Time</FormLabel>
                    <input
                      name="scheduledTime"
                      type="time"
                      required
                      className={`input ${fieldErrors.scheduledTime ? 'border-red-300 focus:border-red-400' : ''}`}
                    />
                    <FieldError message={fieldErrors.scheduledTime} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Who you&apos;re meeting
                </h3>
                <div className="space-y-3">
                  <div>
                    <FormLabel required>Client name</FormLabel>
                    <input
                      name="clientName"
                      required
                      minLength={2}
                      className={`input ${fieldErrors.clientName ? 'border-red-300 focus:border-red-400' : ''}`}
                      placeholder="Contact person from LinkedIn"
                      autoFocus
                    />
                    <FieldError message={fieldErrors.clientName} />
                  </div>
                  <div>
                    <FormLabel>Company</FormLabel>
                    <input name="companyName" className="input" placeholder="Company name" />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Contact details
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Email and phone are optional — add them if you have contact details from LinkedIn.
                </p>
                <div className="space-y-3">
                  <div>
                    <FormLabel>LinkedIn profile</FormLabel>
                    <input
                      name="clientLinkedIn"
                      type="url"
                      className={`input ${fieldErrors.clientLinkedIn ? 'border-red-300 focus:border-red-400' : ''}`}
                      placeholder="https://linkedin.com/in/..."
                    />
                    <FieldError message={fieldErrors.clientLinkedIn} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Email</FormLabel>
                      <input
                        name="clientEmail"
                        type="email"
                        className={`input ${fieldErrors.clientEmail ? 'border-red-300 focus:border-red-400' : ''}`}
                        placeholder="client@company.com"
                      />
                      <FieldError message={fieldErrors.clientEmail} />
                    </div>
                    <div>
                      <FormLabel>Phone</FormLabel>
                      <input
                        name="clientPhone"
                        type="tel"
                        className={`input ${fieldErrors.clientPhone ? 'border-red-300 focus:border-red-400' : ''}`}
                        placeholder="+91 98765 43210"
                      />
                      <FieldError message={fieldErrors.clientPhone} />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Context
                </h3>
                <div>
                  <FormLabel>Notes</FormLabel>
                  <textarea
                    name="notes"
                    rows={3}
                    className="input min-h-[80px]"
                    placeholder="What did they reply on LinkedIn? Agenda for the call?"
                  />
                </div>
              </section>

              {error && (
                <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1 pb-1">
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5">
                  {loading ? 'Scheduling...' : 'Schedule call'}
                </button>
                <button type="button" className="btn-secondary px-5" onClick={close}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
