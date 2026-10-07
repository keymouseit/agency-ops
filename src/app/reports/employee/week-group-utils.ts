import { formatIst } from '@/lib/ist'

export const WEEK_MONTH_GROUP_THRESHOLD = 8

export type WeekRowLike = {
  startKey: string
  endKey: string
  label: string
  hoursLogged: number
  hoursExpected: number
  projects: { projectId: string | null }[]
  hasWorkingDays: boolean
}

export function monthKeyFromWeekStart(startKey: string) {
  return startKey.slice(0, 7) // YYYY-MM (week's Monday)
}

export function monthLabelFromKey(ym: string) {
  const iso = `${ym}-01T00:00:00.000Z`
  return formatIst(iso, { month: 'long', year: 'numeric' })
}

export function groupWeeksByMonth<T extends WeekRowLike>(rows: T[]) {
  const order: string[] = []
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const mk = monthKeyFromWeekStart(r.startKey)
    if (!map.has(mk)) {
      map.set(mk, [])
      order.push(mk)
    }
    map.get(mk)!.push(r)
  }
  return order.map(key => {
    const weeks = map.get(key)!
    const hoursLogged = Math.round(weeks.reduce((s, w) => s + w.hoursLogged, 0) * 10) / 10
    const hoursExpected = Math.round(weeks.reduce((s, w) => s + w.hoursExpected, 0) * 10) / 10
    const projectIds = new Set<string>()
    for (const w of weeks) {
      for (const p of w.projects) {
        if (p.projectId) projectIds.add(p.projectId)
      }
    }
    return {
      key,
      label: monthLabelFromKey(key),
      weeks,
      weekCount: weeks.length,
      hoursLogged,
      hoursExpected,
      projectCount: projectIds.size,
    }
  })
}
