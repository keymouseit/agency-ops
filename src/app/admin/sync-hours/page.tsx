'use client'
import { useState } from 'react'

export default function SyncHoursPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function runSync() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/admin/sync-project-hours', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Failed to sync hours')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">
        Sync Project Actual Hours
      </h1>
      <div className="card p-6">
        <p className="text-sm text-gray-600 mb-6">
          This will recalculate actual hours for all projects by aggregating hours
          from all daily task logs. This is a one-time backfill operation.
        </p>

        <button
          onClick={runSync}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Syncing...' : 'Run Sync'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">Error: {error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium mb-2">
              {result.message}
            </p>
            {result.results && (
              <div className="mt-3 space-y-1 max-h-96 overflow-y-auto">
                {result.results.map((r: any) => (
                  <div key={r.projectId} className="text-xs text-gray-600">
                    {r.projectName}: {r.actualHours}h
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
