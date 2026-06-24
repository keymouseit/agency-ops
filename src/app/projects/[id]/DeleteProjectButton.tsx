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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${projectName}"?\n\nThis permanently removes the project, milestones, check-ins, scope changes, and QA records. Daily tasks will be unlinked but kept. This cannot be undone.`
    )
    if (!confirmed) return

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
    <div className="flex flex-col items-end gap-2">
      {error && (
        <div className="max-w-xs p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 text-right">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="text-xs px-3 py-1.5 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {loading ? 'Deleting...' : 'Delete project'}
      </button>
    </div>
  )
}
