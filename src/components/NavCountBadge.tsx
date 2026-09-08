export default function NavCountBadge({
  count,
  active = false,
}: {
  count: number
  active?: boolean
}) {
  if (count <= 0) return null
  const label = count > 99 ? '99+' : String(count)

  return (
    <span
      className={`ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums inline-flex items-center justify-center ${
        active ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'
      }`}
    >
      {label}
    </span>
  )
}
