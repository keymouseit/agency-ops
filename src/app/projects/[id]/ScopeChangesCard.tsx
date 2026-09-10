'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import { fmtCurrency } from '@/lib/utils'

type ScopeChange = {
  id: string
  description: string
  hoursAdded: number | null
  valueAdded: number | null
  changeOrderSigned: boolean
  approvalStatus: string
  decisionNote: string | null
  createdAt: string
  approvedBy: { name: string } | null
}

type ScopeChangesCardProps = {
  projectId: string
  bdMemberId: string | null
  currentUserId?: string
  userRole?: string
  canViewValue: boolean
  scopeChanges: ScopeChange[]
}

const APPROVAL_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export default function ScopeChangesCard({
  projectId,
  bdMemberId,
  currentUserId,
  userRole,
  canViewValue,
  scopeChanges,
}: ScopeChangesCardProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  const canDecideRole = userRole === 'Founder' || userRole === 'Manager' || bdMemberId === currentUserId

  async function decide(scopeChangeId: string, decision: 'approved' | 'declined') {
    setLoadingId(scopeChangeId)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}/scope/${scopeChangeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed.' }))
        setError(data.error || `Request failed (${res.status}).`)
        return
      }

      softRefresh(router)
    } catch {
      setError('Network error - could not update scope change.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Scope changes ({scopeChanges.length})</h2>
      {error && <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2">{error}</div>}
      {scopeChanges.length === 0
        ? <p className="text-sm text-gray-400">No scope changes. Good.</p>
        : (
          <div className="space-y-2">
            {scopeChanges.map(sc => {
              const canDecide = canDecideRole && sc.approvalStatus === 'pending'
              return (
                <div key={sc.id} className={`p-2 rounded text-xs ${!sc.changeOrderSigned || sc.approvalStatus === 'declined' ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-700 flex-1">{sc.description}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`badge ${APPROVAL_STYLES[sc.approvalStatus] || 'bg-gray-100 text-gray-700'}`}>
                        {sc.approvalStatus}
                      </span>
                      <span className={`badge ${sc.changeOrderSigned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {sc.changeOrderSigned ? 'CO signed' : 'NO CO'}
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-400 mt-0.5">
                    {sc.hoursAdded ? `+${sc.hoursAdded}h` : ''}
                    {sc.valueAdded && canViewValue ? ` · +${fmtCurrency(sc.valueAdded)}` : ''}
                    {' · '}
                    {formatDate(sc.createdAt)}
                    {sc.approvedBy && sc.approvalStatus !== 'pending' ? ` · by ${sc.approvedBy.name}` : ''}
                  </div>
                  {sc.decisionNote && (
                    <div className="text-gray-500 mt-1">Note: {sc.decisionNote}</div>
                  )}
                  {canDecide && (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        disabled={loadingId === sc.id}
                        onClick={() => decide(sc.id, 'approved')}
                        className="btn-secondary text-xs bg-green-50 text-green-800 border-green-100 hover:bg-green-100"
                      >
                        {loadingId === sc.id ? '...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={loadingId === sc.id}
                        onClick={() => decide(sc.id, 'declined')}
                        className="btn-secondary text-xs bg-red-50 text-red-800 border-red-100 hover:bg-red-100"
                      >
                        {loadingId === sc.id ? '...' : 'Decline'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
