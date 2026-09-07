export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-live="polite" aria-busy="true">
      <div className="h-20 rounded-xl bg-gray-200/80" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 rounded-xl bg-gray-200/70" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-28 rounded-xl bg-gray-200/70" />
        <div className="h-28 rounded-xl bg-gray-200/60" />
        <div className="h-28 rounded-xl bg-gray-200/50" />
      </div>
    </div>
  )
}
