'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { fmtDateTime } from '@/lib/utils'

export type WaitingProspect = {
  id: string
  name: string
  company: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  campaignName: string
  accountName: string
  repliedAt: string | null
  lastClientMessage: string | null
  lastClientMessageAt: string | null
  isConnected: boolean
}

function daysWaiting(repliedAt: string | null) {
  if (!repliedAt) return null
  const start = new Date(repliedAt)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  const utcStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(0, Math.floor((utcNow - utcStart) / (1000 * 60 * 60 * 24)))
}

function waitingLabel(days: number | null) {
  if (days == null) return null
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  return `${days} days`
}

export default function SalesRobotWaitingList({
  rows,
  canMarkDone,
}: {
  rows: WaitingProspect[]
  canMarkDone: boolean
}) {
  const router = useRouter()
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const visible = rows.filter(r => !doneIds.has(r.id))

  async function markDone(id: string) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/integrations/salesrobot/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpCompleted: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not mark done')
        return
      }
      setDoneIds(prev => new Set(prev).add(id))
      toast.success('Marked as followed up')
      router.refresh()
    } catch {
      toast.error('Could not mark done')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Waiting for us</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Prospects who replied and still need a follow-up
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {visible.length}
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-500">
          Nobody waiting — all replied prospects are followed up (or sync to pull replies).
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full min-w-[1040px] text-sm border-collapse table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[26%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
                  <th className="text-left font-medium px-4 py-3">Prospect</th>
                  <th className="text-left font-medium px-3 py-3">Campaign</th>
                  <th className="text-left font-medium px-3 py-3">Account</th>
                  <th className="text-left font-medium px-3 py-3">Client last message</th>
                  <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Waiting</th>
                  <th className="text-right font-medium px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(row => {
                  const days = daysWaiting(row.lastClientMessageAt || row.repliedAt)
                  const replyDate = row.lastClientMessageAt || row.repliedAt
                  const label = waitingLabel(days)
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-amber-50/40"
                    >
                      <td className="px-4 py-2.5 align-top">
                        <div className="min-w-0">
                          {row.linkedinUrl ? (
                            <a
                              href={row.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 hover:text-blue-700 break-words"
                            >
                              {row.name}
                            </a>
                          ) : (
                            <span className="font-medium text-gray-900 break-words">{row.name}</span>
                          )}
                          <div className="text-xs text-gray-500 mt-0.5 break-words">
                            {[row.jobTitle, row.company].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 align-top">
                        <span className="break-words" title={row.campaignName}>
                          {row.campaignName}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 text-xs align-top">
                        <span className="break-words" title={row.accountName}>
                          {row.accountName}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 align-top">
                        {row.lastClientMessage ? (
                          <p className="text-xs leading-relaxed line-clamp-3" title={row.lastClientMessage}>
                            {row.lastClientMessage}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-400">
                            No message synced yet — run Sync now
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top">
                        {label == null ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <div>
                            <div
                              className={`tabular-nums font-medium ${
                                days != null && days >= 3 ? 'text-amber-700' : 'text-gray-800'
                              }`}
                            >
                              {label}
                            </div>
                            {replyDate && (
                              <div className="text-[11px] text-gray-400 mt-0.5 whitespace-normal">
                                since {fmtDateTime(replyDate)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap align-top">
                        {canMarkDone ? (
                          <button
                            type="button"
                            disabled={loadingId === row.id}
                            onClick={() => markDone(row.id)}
                            className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                          >
                            {loadingId === row.id ? 'Saving…' : 'Mark done'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
