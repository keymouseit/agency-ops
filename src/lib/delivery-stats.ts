import { avg } from '@/lib/utils'

type DeliveredProject = { estimatedHours: number | null; actualHours: number | null; onTime: boolean | null }

/**
 * Estimate accuracy + on-time rate across delivered projects that have both
 * estimated and actual hours. Single source for Business → Summary / Delivery.
 */
export function deliveryStats<T extends DeliveredProject>(delivered: T[]) {
  const withData = delivered.filter(p => p.estimatedHours && p.actualHours)
  const onTimeCount = withData.filter(p => p.onTime).length
  return {
    withData,
    onTimeCount,
    avgEstAccuracy: withData.length
      ? Math.round(avg(withData.map(p => (p.actualHours! / p.estimatedHours!) * 100)))
      : null,
    onTimeRate: withData.length ? Math.round((onTimeCount / withData.length) * 100) : null,
  }
}

/** ≤115% is the estimation target used across reports. */
export function accuracyColor(acc: number | null) {
  if (acc == null) return 'text-gray-300'
  return acc <= 115 ? 'text-gray-900' : acc <= 140 ? 'text-amber-700' : 'text-red-600'
}
