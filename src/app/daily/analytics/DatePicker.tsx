'use client'

import { useRouter } from 'next/navigation'

export default function DatePicker({ value }: { value: string }) {
  const router = useRouter()

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</span>
      <input
        type="date"
        className="input w-auto"
        value={value}
        max={new Date().toISOString().slice(0, 10)}
        onChange={e => {
          const next = e.target.value
          router.push(next ? `/daily/analytics?date=${next}` : '/daily/analytics')
        }}
      />
    </label>
  )
}
