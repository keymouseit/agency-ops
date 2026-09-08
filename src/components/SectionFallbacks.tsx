export function CardSectionFallback({ className = 'mb-5' }: { className?: string }) {
  return (
    <div className={`card overflow-hidden animate-pulse ${className}`} aria-hidden>
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-16 bg-gray-100 rounded-xl" />
        <div className="h-16 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}

export function DashboardKpiFallback() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card p-5 h-24 bg-gray-100/80" />
        ))}
      </div>
      <div className="card p-4 h-28 bg-gray-100/70" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5 h-64 bg-gray-100/60" />
        <div className="card p-5 h-64 bg-gray-100/60" />
      </div>
    </div>
  )
}
