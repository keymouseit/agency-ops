import { startOfDay, subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { deliveryStats, accuracyColor } from '@/lib/delivery-stats'
import ShowMoreRows from '@/components/ShowMoreRows'

const VISIBLE_DELIVERED = 10

/** Business → Delivery: estimate accuracy, on-time rate, where time goes (30d). */
export default async function DeliveryTab() {
  const since = subDays(startOfDay(new Date()), 30)
  const [delivered, timeByType] = await Promise.all([
    prisma.project.findMany({
      where: { status: 'delivered' },
      select: {
        id: true,
        name: true,
        estimatedHours: true,
        actualHours: true,
        onTime: true,
        clientScore: true,
        actualEnd: true,
        developer: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.dailyTask.groupBy({
      by: ['taskType'],
      where: { projectId: { not: null }, createdAt: { gte: since }, actualHours: { not: null } },
      _sum: { actualHours: true },
    }),
  ])

  const { withData, onTimeCount, avgEstAccuracy, onTimeRate } = deliveryStats(delivered)
  const phaseTime = timeByType
    .map(r => ({ type: r.taskType, hours: r._sum.actualHours ?? 0 }))
    .filter(r => r.hours > 0)
    .sort((a, b) => b.hours - a.hours)
  const totalHours = phaseTime.reduce((s, r) => s + r.hours, 0)

  const renderRow = (p: (typeof withData)[number]) => {
    const acc = Math.round((p.actualHours! / p.estimatedHours!) * 100)
    return (
      <tr key={p.id}>
        <td className="py-2 pr-3 font-medium text-gray-800">{p.name}</td>
        <td className="py-2 pr-3 text-gray-500">{p.developer.name}</td>
        <td className="text-center py-2 tabular-nums">{p.estimatedHours}h</td>
        <td className="text-center py-2 tabular-nums">{p.actualHours}h</td>
        <td className="text-center py-2">
          <span className={`font-semibold tabular-nums ${accuracyColor(acc)}`}>{acc}%</span>
        </td>
        <td className="text-center py-2">
          {p.onTime ? <span className="text-gray-700">✓</span> : <span className="text-red-500">✗</span>}
        </td>
        <td className="text-center py-2 tabular-nums">
          {p.clientScore ? (
            <span className={`font-semibold ${p.clientScore >= 8 ? 'text-gray-900' : p.clientScore >= 6 ? 'text-amber-700' : 'text-red-600'}`}>
              {p.clientScore}/10
            </span>
          ) : (
            '—'
          )}
        </td>
      </tr>
    )
  }
  const head = (
    <thead>
      <tr className="text-xs text-gray-400 uppercase tracking-wide">
        <th className="text-left pb-2 font-medium">Project</th>
        <th className="text-left pb-2 font-medium">Owner</th>
        <th className="text-center pb-2 font-medium">Est.</th>
        <th className="text-center pb-2 font-medium">Actual</th>
        <th className="text-center pb-2 font-medium">Accuracy</th>
        <th className="text-center pb-2 font-medium">On time</th>
        <th className="text-center pb-2 font-medium">Client</th>
      </tr>
    </thead>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Estimate accuracy</div>
          <div className={`text-2xl font-semibold tabular-nums ${avgEstAccuracy == null ? 'text-gray-300' : accuracyColor(avgEstAccuracy)}`}>
            {avgEstAccuracy != null ? `${avgEstAccuracy}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Avg actual / estimated hours · target ≤115%</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">On-time delivery</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              onTimeRate == null ? 'text-gray-300' : onTimeRate >= 80 ? 'text-gray-900' : onTimeRate >= 60 ? 'text-amber-700' : 'text-red-600'
            }`}
          >
            {onTimeRate != null ? `${onTimeRate}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {onTimeCount} of {withData.length} delivered on time · target ≥80%
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Hours logged · 30d</div>
          <div className="text-2xl font-semibold tabular-nums text-gray-900">{totalHours.toFixed(0)}h</div>
          <div className="text-xs text-gray-500 mt-0.5">Across all projects, from daily EODs</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card p-5 lg:col-span-2 self-start">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Estimate accuracy by project</h2>
          <p className="text-xs text-gray-500 mb-4">Delivered projects with estimated and actual hours, most recent first.</p>
          {withData.length === 0 ? (
            <p className="text-sm text-gray-400">No delivered projects with hour data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {head}
                <ShowMoreRows rows={withData.map(renderRow)} initial={VISIBLE_DELIVERED} colSpan={7} noun="projects" />
              </table>
            </div>
          )}
        </section>

        <section className="card p-5 self-start">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Where time goes</h2>
          <p className="text-xs text-gray-500 mb-4">Hours by task type, all projects, last 30 days.</p>
          {totalHours === 0 ? (
            <p className="text-sm text-gray-400">No hours logged yet.</p>
          ) : (
            <div className="space-y-3">
              {phaseTime.map(({ type, hours }) => {
                const pct = Math.round((hours / totalHours) * 100)
                return (
                  <div key={type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="text-gray-500 tabular-nums">
                        {hours.toFixed(1)}h · {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gray-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
