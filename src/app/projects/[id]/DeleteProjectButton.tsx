'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to delete project' }))
        setError(data.error ?? `Failed to delete project (${res.status})`)
        setLoading(false)
        return
      }

      router.push('/projects')
      router.refresh()
    } catch {
      setError('Network error — could not delete project.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('')
          setShowModal(true)
        }}
        disabled={loading}
        className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        Delete project
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !loading && setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete project?</h3>
            <p className="text-sm text-gray-600 mb-1">
              You are about to delete <span className="font-medium text-gray-900">{projectName}</span>.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              This permanently removes the project, milestones, check-ins, scope changes, and QA records.
              Daily tasks will be unlinked but kept. This cannot be undone.
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
                disabled={loading}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
                onClick={handleDelete}
              >
                {loading ? 'Deleting...' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
