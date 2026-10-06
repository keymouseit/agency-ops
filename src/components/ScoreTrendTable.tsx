import { subWeeks } from 'date-fns'
import { avg, getWeekStart } from '@/lib/utils'
import { formatIst } from '@/lib/ist'

type TrendScore = { weekOf: Date; delivery: number; process: number; culture: number }

const DIMS = ['delivery', 'process', 'culture'] as const

function cellColor(v: number) {
  return v >= 8 ? 'text-gray-900' : v >= 6 ? 'text-amber-700' : 'text-red-600'
}

/**
 * Team score trends — weekly averages for the last N weeks (moved from /analytics).
 * Scores are bucketed by their Monday week start (same as check-ins / getWeekStart).
 */
export default function ScoreTrendTable({
  scores,
  weeksBack = 8,
  title = `Team score trends — last ${weeksBack} weeks`,
}: {
  scores: TrendScore[]
  weeksBack?: number
  title?: string
}) {
  const weeks = Array.from({ length: weeksBack }, (_, i) => getWeekStart(subWeeks(new Date(), weeksBack - 1 - i)))
  const byWeek = new Map<number, TrendScore[]>()
  for (const s of scores) {
    const key = getWeekStart(new Date(s.weekOf)).getTime()
    const list = byWeek.get(key)
    if (list) list.push(s)
    else byWeek.set(key, [s])
  }
  const weeklyAvgs = weeks.map(w => {
    const ws = byWeek.get(w.getTime()) ?? []
    return {
      week: w,
      delivery: ws.length ? avg(ws.map(s => s.delivery)) : null,
      process: ws.length ? avg(ws.map(s => s.process)) : null,
      culture: ws.length ? avg(ws.map(s => s.culture)) : null,
    }
  })

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400">
              <th className="text-left pb-2 font-medium">Week of</th>
              {weeklyAvgs.map((w, i) => (
                <th key={i} className="text-center pb-2 font-medium whitespace-nowrap">
                  {formatIst(w.week, { day: 'numeric', month: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {DIMS.map(dim => (
              <tr key={dim}>
                <td className="py-2 text-gray-500 capitalize font-medium">{dim}</td>
                {weeklyAvgs.map((w, i) => {
                  const v = w[dim]
                  return (
                    <td key={i} className="text-center py-2 tabular-nums">
                      {v != null ? (
                        <span className={`font-semibold ${cellColor(v)}`}>{v.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
