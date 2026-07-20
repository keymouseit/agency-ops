'use client'

import { useState } from 'react'

export default function MomExportButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mom/export')
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Export failed')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `mom-export-${new Date().toISOString().slice(0, 10)}.xlsx`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={loading}
        className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-60"
      >
        {loading ? 'Preparing…' : 'Download XLSX'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
