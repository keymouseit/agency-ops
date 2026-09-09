'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import type { PendingLeaveRequest } from '@/lib/leave-pending'
import { notifyLeavesPendingChanged } from '@/hooks/usePendingLeaveCount'

const PREVIEW_LIMIT = 3

function typeBadgeClass(leaveType: string) {
  if (leaveType === 'short_leave') return 'bg-sky-50 text-sky-700 ring-sky-600/15'
  if (leaveType === 'half_day') return 'bg-amber-50 text-amber-800 ring-amber-600/15'
  if (leaveType === 'birthday_leave') return 'bg-pink-50 text-pink-800 ring-pink-600/15'
  if (leaveType === 'work_from_home') return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15'
  return 'bg-violet-50 text-violet-800 ring-violet-600/15'
}

function unpaidLabel(req: PendingLeaveRequest) {
  if (!req.unpaid && req.unpaidDays <= 0) return null
  if (req.paidDays > 0 && req.unpaidDays > 0) {
    return `${req.paidDays} paid + ${req.unpaidDays} unpaid`
  }
  return 'Unpaid'
}

export default function PendingLeaveRequestsCard({
  initialRequests,
}: {
  initialRequests: PendingLeaveRequest[]
}) {
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const visible = requests.slice(0, PREVIEW_LIMIT)
  const hiddenCount = Math.max(0, requests.length - visible.length)

  function openDecision(id: string, status: 'approved' | 'rejected') {
    setActiveId(id)
    setDecision(status)
    setNotes('')
  }

  function cancelDecision() {
    setActiveId(null)
    setDecision(null)
    setNotes('')
  }

  async function submitDecision() {
    if (!activeId || !decision) return
    const trimmed = notes.trim()
    if (!trimmed) {
      toast.error(
        decision === 'rejected'
          ? 'Please provide a reason for rejection'
          : 'Please add a comment for approval'
      )
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/leaves/${activeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decision, approvalNotes: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      setRequests(prev => prev.filter(r => r.id !== activeId))
      toast.success(decision === 'approved' ? 'Leave approved' : 'Leave rejected')
      cancelDecision()
      notifyLeavesPendingChanged()
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card px-4 py-3 mb-5 ring-1 ring-amber-100">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Leave requests</h2>
          <span
            className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              requests.length > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {requests.length}
          </span>
        </div>
        <Link href="/leaves" className="text-xs text-blue-600 hover:underline shrink-0">
          {hiddenCount > 0 ? `+${hiddenCount} more →` : 'All leaves →'}
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">No pending leave requests.</p>
      ) : (
        <ul className="divide-y divide-amber-100/80">
          {visible.map(req => {
            const unpaid = unpaidLabel(req)
            const deciding = activeId === req.id && decision
            return (
              <li key={req.id} className="py-1.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 min-h-[32px]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {req.memberName}
                      </span>
                      <span className="text-[11px] text-gray-500 truncate">{req.dateLabel}</span>
                    </div>
                    {req.reason ? (
                      <p className="text-[11px] text-gray-500 truncate" title={req.reason}>
                        {req.reason}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ring-1 ring-inset ${typeBadgeClass(req.leaveType)}`}
                  >
                    {req.label}
                  </span>
                  {unpaid ? (
                    <span className="hidden sm:inline-flex shrink-0 items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide bg-orange-50 text-orange-800 ring-1 ring-orange-600/15">
                      {unpaid}
                    </span>
                  ) : null}
                  {deciding ? null : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openDecision(req.id, 'rejected')}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => openDecision(req.id, 'approved')}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>

                {deciding ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="flex-1 min-w-0 text-xs rounded-md border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder={
                        decision === 'rejected'
                          ? 'Rejection reason'
                          : 'Approval comment'
                      }
                    />
                    <button
                      type="button"
                      onClick={cancelDecision}
                      disabled={saving}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitDecision}
                      disabled={saving}
                      className={`px-2 py-1 rounded-md text-[11px] font-semibold text-white disabled:opacity-50 ${
                        decision === 'rejected'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {saving ? 'Saving…' : 'Confirm'}
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
