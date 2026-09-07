'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Cycle = {
  id: string
  cycleType: string
  environment: string
  result: string
  signOff: unknown
}

export default function TestCycleManageButtons({
  projectId,
  cycle,
  hasProjectSignOff,
  onEdit,
}: {
  projectId: string
  cycle: Cycle
  hasProjectSignOff: boolean
  onEdit: () => void
}) {
  const router = useRouter()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  if (hasProjectSignOff || cycle.signOff) return null

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/qa/${projectId}/cycle/${cycle.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete test cycle')
      setShowDeleteModal(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test cycle')
    } finally {
      setDeleting(false)
    }
  }

  const cycleLabel = `${cycle.cycleType.replace(/_/g, ' ')} · ${cycle.environment}`

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-gray-800"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="text-xs text-red-600 hover:text-red-800"
          onClick={() => {
            setError('')
            setShowDeleteModal(true)
          }}
        >
          Delete
        </button>
      </div>

      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete test cycle?</h3>
            <p className="text-sm text-gray-600 mb-1">
              You are about to delete the <span className="font-medium text-gray-900">{cycleLabel}</span> test cycle
              <span className="capitalize"> ({cycle.result})</span>.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              All test cases and dev fix notes on this cycle will be removed. This cannot be undone.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Deleting...' : 'Delete test cycle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
