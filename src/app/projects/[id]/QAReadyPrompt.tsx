'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'

interface QAReadyPromptProps {
  projectId: string
  projectName: string
}

export default function QAReadyPrompt({ projectId, projectName }: QAReadyPromptProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMoveToQA = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'qa' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update project status')
      }

      softRefresh(router)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✓</span>
            <h3 className="text-sm font-semibold text-green-900">
              All milestones ready for QA
            </h3>
          </div>
          <p className="text-sm text-green-700">
            All milestones have been marked as ready for QA. Move the project to QA status so the QA team can begin sign-off.
          </p>
          {error && (
            <p className="text-sm text-red-600 mt-2">
              {error}
            </p>
          )}
        </div>
        <button
          onClick={handleMoveToQA}
          disabled={loading}
          className="btn-primary whitespace-nowrap"
        >
          {loading ? 'Moving...' : 'Move to QA'}
        </button>
      </div>
    </div>
  )
}
