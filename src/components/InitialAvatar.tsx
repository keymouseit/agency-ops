const PALETTE = [
  'bg-indigo-50 text-indigo-700 ring-indigo-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-teal-50 text-teal-700 ring-teal-100',
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-slate-100 text-slate-700 ring-slate-200',
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Initials in a soft, name-stable colour circle. */
export default function InitialAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const tone = PALETTE[hash % PALETTE.length]
  const dims = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ${dims} ${tone}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
