'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useSalesRobotTransition } from './SalesRobotLoading'

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]

type CampaignOption = { id: string; label: string; accountId?: string; status?: string }
type Option = { id: string; label: string }

const selectClass =
  'mt-1.5 w-full appearance-none border border-gray-200 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 disabled:bg-gray-50 disabled:text-gray-500'

export default function SalesRobotFilters({
  campaigns,
  accounts,
  statuses,
}: {
  campaigns: CampaignOption[]
  accounts: Option[]
  statuses: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pending, run } = useSalesRobotTransition()

  const preset = searchParams.get('preset') || 'last_30_days'
  const campaignId = searchParams.get('campaignId') || ''
  const accountId = searchParams.get('accountId') || ''
  const status = searchParams.get('status') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const visibleCampaigns = campaigns.filter(c => {
    if (accountId && c.accountId && c.accountId !== accountId) return false
    if (status && c.status && c.status !== status) return false
    return true
  })

  const activeCount = [campaignId, accountId, status, preset !== 'last_30_days' ? preset : '']
    .filter(Boolean).length

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key)
      else params.set(key, value)
    }

    // Filter changes invalidate waiting pagination — reset to page 1.
    params.delete('waitingPage')

    if (next.preset && next.preset !== 'custom') {
      params.delete('from')
      params.delete('to')
    }

    const nextAccountId = next.accountId !== undefined ? next.accountId || '' : accountId
    const nextCampaignId = next.campaignId !== undefined ? next.campaignId || '' : campaignId
    if (nextAccountId && nextCampaignId) {
      const match = campaigns.find(c => c.id === nextCampaignId)
      if (match?.accountId && match.accountId !== nextAccountId) {
        params.delete('campaignId')
      }
    }

    const nextStatus = next.status !== undefined ? next.status || '' : status
    const campaignAfter = params.get('campaignId') || ''
    if (nextStatus && campaignAfter) {
      const match = campaigns.find(c => c.id === campaignAfter)
      if (match?.status && match.status !== nextStatus) {
        params.delete('campaignId')
      }
    }

    run(() => {
      router.push(`/salesrobot?${params.toString()}`)
    })
  }

  function clearFilters() {
    run(() => {
      const params = new URLSearchParams()
      const tab = searchParams.get('tab')
      if (tab === 'waiting') params.set('tab', 'waiting')
      const q = params.toString()
      router.push(q ? `/salesrobot?${q}` : '/salesrobot')
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div>
            <div className="text-sm font-medium text-gray-900">Filters</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Slice performance by date, campaign, account, or status
            </div>
          </div>
          {pending && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 text-white px-2.5 py-1 text-[11px] font-medium">
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Loading
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            disabled={pending}
            className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs font-medium text-gray-500">
          Date range
          <select
            className={selectClass}
            value={preset}
            disabled={pending}
            onChange={e => update({ preset: e.target.value })}
          >
            {PRESETS.map(p => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-500">
          Campaign
          <select
            className={selectClass}
            value={campaignId}
            disabled={pending}
            onChange={e => update({ campaignId: e.target.value || null })}
          >
            <option value="">All campaigns</option>
            {visibleCampaigns.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-500">
          LinkedIn account
          <select
            className={selectClass}
            value={accountId}
            disabled={pending}
            onChange={e => update({ accountId: e.target.value || null })}
          >
            <option value="">All accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-500">
          Campaign status
          <select
            className={selectClass}
            value={status}
            disabled={pending}
            onChange={e => update({ status: e.target.value || null })}
          >
            <option value="">All statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preset === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
          <label className="text-xs font-medium text-gray-500">
            From
            <input
              type="date"
              className={selectClass}
              value={from}
              disabled={pending}
              onChange={e =>
                update({ preset: 'custom', from: e.target.value, to: to || e.target.value })
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            To
            <input
              type="date"
              className={selectClass}
              value={to}
              disabled={pending}
              onChange={e =>
                update({ preset: 'custom', from: from || e.target.value, to: e.target.value })
              }
            />
          </label>
        </div>
      )}
    </div>
  )
}
