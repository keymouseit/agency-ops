export default function LeaveHourPolicyCard() {
  return (
    <section className="flex-1 min-w-0 rounded-2xl bg-white ring-1 ring-gray-900/5 shadow-sm px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 ring-1 ring-amber-100 px-2 py-1 text-xs text-amber-900">
        <span className="font-semibold">Half day</span>
        <span className="tabular-nums font-bold">4.5h</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 ring-1 ring-sky-100 px-2 py-1 text-xs text-sky-900">
        <span className="font-semibold">Short leave</span>
        <span className="tabular-nums font-bold">7h</span>
      </span>
      <p className="text-xs text-gray-600 leading-snug min-w-[14rem] flex-1">
        <span className="font-semibold text-gray-800">Cannot be combined</span> on the same day.
        {' '}Below minimum hours do not count as leave.{' '}
        <span className="font-semibold text-gray-800">Example:</span> 2 hours is not a working day, half day, or short leave.
      </p>
    </section>
  )
}
