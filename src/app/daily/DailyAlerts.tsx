type Member = { id: string; name: string }
type Log = { id: string; member: { name: string } }

type Props = {
  noPlan: Member[]
  noEOD: Log[]
  blockers: Array<{ id: string; member: { name: string }; blockers: string | null }>
}

export default function DailyAlerts({ noPlan, noEOD, blockers }: Props) {
  const hasAlerts = noPlan.length > 0 || noEOD.length > 0 || blockers.length > 0
  if (!hasAlerts) return null

  return (
    <div className="mb-6 space-y-3">
      {(noPlan.length > 0 || noEOD.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {noPlan.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base" aria-hidden>
                  ⚠️
                </span>
                <div className="text-xs font-semibold text-red-900 uppercase tracking-wide">
                  No morning plan ({noPlan.length})
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {noPlan.map(m => (
                  <span key={m.id} className="badge bg-red-100 text-red-800 text-xs">
                    {m.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          )}
          {noEOD.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base" aria-hidden>
                  ⏳
                </span>
                <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                  EOD pending ({noEOD.length})
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {noEOD.map(l => (
                  <span key={l.id} className="badge bg-amber-100 text-amber-800 text-xs">
                    {l.member.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {blockers.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-red-100 bg-red-50">
            <span className="text-xs font-semibold text-red-900 uppercase tracking-wide">
              Active blockers ({blockers.length})
            </span>
          </div>
          <div className="divide-y divide-red-100">
            {blockers.map(l => (
              <div key={l.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-red-900">{l.member.name}</span>
                <p className="text-red-800 mt-0.5 whitespace-pre-wrap">{l.blockers}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
