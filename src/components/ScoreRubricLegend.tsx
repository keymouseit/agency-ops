/**
 * Compact collapsible rubric for weekly scores (Delivery / Process / …).
 * Plain <details> — no client JS required.
 */
export default function ScoreRubricLegend() {
  return (
    <details className="card group mb-0">
      <summary className="cursor-pointer select-none list-none px-5 py-3.5 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">How scores work</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Delivery · Process · Communication · Growth · Culture — 1–10 weekly.
          </p>
        </div>
        <span className="text-xs text-gray-400 shrink-0 group-open:hidden">Show</span>
        <span className="text-xs text-gray-400 shrink-0 hidden group-open:inline">Hide</span>
      </summary>
      <div className="px-5 pb-4 border-t border-gray-100 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {[
            ['Delivery', 'Commits met, milestones hit, QA pass rate, no client-found bugs'],
            ['Process', 'Rules followed: scope CO, estimation template, handover notes, test coverage'],
            ['Communication', 'Daily updates, blockers raised <1hr, client updated before they ask'],
            ['Growth', 'Same mistake not repeated, new skill applied, feedback implemented'],
            ['Culture', 'No ego, takes feedback, supports teammates, owns mistakes openly'],
          ].map(([dim, desc]) => (
            <div key={dim} className="min-w-0">
              <div className="font-semibold text-gray-700 mb-0.5">{dim}</div>
              <div className="text-gray-400 leading-snug">{desc}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100 text-xs">
          <span className="text-green-700">8–10 Strong</span>
          <span className="text-amber-700">6–7 Acceptable</span>
          <span className="text-red-600">4–5 Needs improvement</span>
          <span className="text-red-800 font-medium">1–3 At risk — 1-on-1</span>
        </div>
      </div>
    </details>
  )
}
