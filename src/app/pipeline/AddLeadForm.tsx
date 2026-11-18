'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LEAD_SOURCES } from '@/lib/utils'
import BodyScrollLock from '@/components/BodyScrollLock'
import SimpleSelect from '@/components/SimpleSelect'

const CURRENCIES = ['USD', 'AED', 'INR', 'GBP', 'EUR', 'AUD'] as const

type Member = { id: string; name: string; role: string }

export default function AddLeadForm({ members }: { members: Member[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<string>(LEAD_SOURCES[0])
  const [ownerId, setOwnerId] = useState('')
  const [currency, setCurrency] = useState<string>('USD')
  const router = useRouter()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd)),
    })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  const bdMembers = members.filter(m => ['BD', 'Both', 'Founder'].includes(m.role))
  const defaultOwnerId = bdMembers[0]?.id ?? ''

  return (
    <>
      <button
        type="button"
        className="btn-primary inline-flex items-center justify-center text-sm !px-3 !py-2 whitespace-nowrap shrink-0"
        onClick={() => {
          setSource(LEAD_SOURCES[0])
          setOwnerId(defaultOwnerId)
          setCurrency('USD')
          setOpen(true)
        }}
      >
        + Add lead
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <BodyScrollLock />
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold mb-4">New lead</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">Client name *</label>
                <input name="clientName" required className="input" placeholder="Company or person name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Source *</label>
                  <SimpleSelect
                    name="source"
                    required
                    aria-label="Source"
                    value={source}
                    onChange={setSource}
                    options={LEAD_SOURCES.map(s => ({ value: s, label: s }))}
                  />
                </div>
                <div>
                  <label className="label">Owner *</label>
                  <SimpleSelect
                    name="ownerId"
                    required
                    aria-label="Owner"
                    value={ownerId || defaultOwnerId}
                    onChange={setOwnerId}
                    options={bdMembers.map(m => ({ value: m.id, label: m.name }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Budget</label>
                  <input name="budget" type="number" className="input" placeholder="0" />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <SimpleSelect
                    name="currency"
                    aria-label="Currency"
                    value={currency}
                    onChange={setCurrency}
                    options={CURRENCIES.map(c => ({ value: c, label: c }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" rows={2} className="input" placeholder="Brief description of what the client needs..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Saving...' : 'Add lead'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
