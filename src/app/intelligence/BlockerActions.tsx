'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BlockerActions({ blocker }: { blocker: { id: string; status: string } }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function update(status: string, founderNote?: string) {
    setLoading(true)
    await fetch(`/api/blockers/${blocker.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, founderNote }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1 flex-shrink-0">
      <button
        onClick={() => update('resolved')}
        disabled={loading}
        className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
      >
        Resolve
      </button>
      <button
        onClick={() => update('escalated', 'Founder reviewing')}
        disabled={loading}
        className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
      >
        Escalate
      </button>
    </div>
  )
}
