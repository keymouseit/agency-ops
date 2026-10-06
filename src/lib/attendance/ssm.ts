import { istDateInputValue } from '@/lib/ist'
import { isWeekendDateKey } from './math'

const API_BASE_URL = 'https://screenshotmonitor.com/api/v2'

export type SsmEmployment = { id: number; name: string }

export type SsmActivity = {
  employmentId: number
  from: number // unix seconds
  to: number
}

export type SsmDayActivity = {
  employmentId: number
  name: string
  date: string // YYYY-MM-DD IST
  start: string // HH:MM IST
  end: string
  twhSeconds: number
  grossSeconds: number
}

function formatTimeIst(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function hasScreenshotMonitorToken(): boolean {
  return Boolean(process.env.SM_API_TOKEN?.trim())
}

async function ssmPost<T>(path: string, body: unknown): Promise<T> {
  const token = process.env.SM_API_TOKEN?.trim()
  if (!token) {
    throw new Error('SM_API_TOKEN is not configured')
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'X-SSM-Token': token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`ScreenshotMonitor ${path} failed (${res.status}): ${text.slice(0, 200)}`)
  }

  return res.json() as Promise<T>
}

/** Fetch company employments from ScreenshotMonitor GetCommonData. */
export async function fetchSsmEmployments(): Promise<SsmEmployment[]> {
  const commonData = await ssmPost<{
    companies?: Array<{ employments?: Array<{ id: number; name: string }> }>
    employmentId?: number
  }>('/GetCommonData', null)

  const employments: SsmEmployment[] = []
  const company = commonData.companies?.[0]
  if (company?.employments?.length) {
    for (const e of company.employments) {
      if (e?.id != null && e.name) employments.push({ id: e.id, name: e.name })
    }
  }
  return employments
}

/**
 * Fetch activities for employment IDs between IST date keys (inclusive).
 * Timestamps use IST midnight boundaries.
 */
export async function fetchSsmActivities(
  employmentIds: number[],
  fromKey: string,
  toKey: string,
): Promise<SsmActivity[]> {
  if (employmentIds.length === 0) return []

  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  // IST midnight = previous day 18:30 UTC
  const fromTs = Math.floor(Date.UTC(fy, fm - 1, fd, 0, 0, 0) / 1000) - 5.5 * 3600
  const toTs = Math.floor(Date.UTC(ty, tm - 1, td, 23, 59, 59) / 1000) - 5.5 * 3600

  const batchPayload = employmentIds.map(employmentId => ({
    employmentId,
    from: fromTs,
    to: toTs,
  }))

  const activities = await ssmPost<SsmActivity[]>('/GetActivities', batchPayload)
  return Array.isArray(activities) ? activities : []
}

/** Group raw activities into per-employment per-IST-day rollups (weekends skipped). */
export function rollupActivitiesByDay(
  activities: SsmActivity[],
  nameByEmploymentId: Map<number, string>,
): SsmDayActivity[] {
  type Acc = {
    employmentId: number
    name: string
    date: string
    starts: number[]
    ends: number[]
    totalDuration: number
  }
  const groups: Record<string, Acc> = {}

  for (const act of activities) {
    if (act?.from == null || act?.to == null || act.employmentId == null) continue
    const startTime = new Date(act.from * 1000)
    const endTime = new Date(act.to * 1000)
    const dateKey = istDateInputValue(startTime)
    if (isWeekendDateKey(dateKey)) continue

    const name = nameByEmploymentId.get(act.employmentId)
    if (!name) continue

    const key = `${act.employmentId}-${dateKey}`
    if (!groups[key]) {
      groups[key] = {
        employmentId: act.employmentId,
        name,
        date: dateKey,
        starts: [],
        ends: [],
        totalDuration: 0,
      }
    }
    groups[key].starts.push(startTime.getTime())
    groups[key].ends.push(endTime.getTime())
    groups[key].totalDuration += act.to - act.from
  }

  return Object.values(groups).map(g => {
    const minStart = new Date(Math.min(...g.starts))
    const maxEnd = new Date(Math.max(...g.ends))
    return {
      employmentId: g.employmentId,
      name: g.name,
      date: g.date,
      start: formatTimeIst(minStart),
      end: formatTimeIst(maxEnd),
      twhSeconds: g.totalDuration,
      grossSeconds: (maxEnd.getTime() - minStart.getTime()) / 1000,
    }
  })
}
