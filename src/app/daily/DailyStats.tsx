type Stat = {
  label: string
  value: string
  good?: boolean
  bad?: boolean
  icon?: string
}

export default function DailyStats({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null

  return (
    <div className={`grid gap-3 mb-6 ${stats.length >= 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
      {stats.map(stat => (
        <div
          key={stat.label}
          className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-tight">
              {stat.label}
            </div>
            {stat.icon && (
              <span className="text-base opacity-80 shrink-0" aria-hidden>
                {stat.icon}
              </span>
            )}
          </div>
          <div
            className={`text-xl font-semibold tracking-tight ${
              stat.bad ? 'text-red-600' : stat.good ? 'text-green-700' : 'text-gray-900'
            }`}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}
