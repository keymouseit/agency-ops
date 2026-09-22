import { prisma } from '@/lib/prisma'
import { businessDayKey } from '@/lib/daily'

export type BdAccountActivityRow = {
  linkedinAccountId: string
  accountName: string
  newOutreach: number
  followUps: number
  replies: number
  meetingsBooked: number
  source: 'salesrobot' | 'manual'
}

export function isLinkedInOutreachTask(task: {
  taskType: string
  project?: { name: string } | null
}) {
  if (task.taskType !== 'bd_outreach') return false
  const name = (task.project?.name || '').toLowerCase().replace(/[^a-z]/g, '')
  return name.includes('linkedin')
}

export function parseBdActivityJson(raw: string | null | undefined): BdAccountActivityRow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row: Partial<BdAccountActivityRow>) => ({
        linkedinAccountId: String(row.linkedinAccountId || ''),
        accountName: String(row.accountName || 'Account'),
        newOutreach: Math.max(0, Number(row.newOutreach) || 0),
        followUps: Math.max(0, Number(row.followUps) || 0),
        replies: Math.max(0, Number(row.replies) || 0),
        meetingsBooked: Math.max(0, Number(row.meetingsBooked) || 0),
        source: (row.source === 'manual' ? 'manual' : 'salesrobot') as BdAccountActivityRow['source'],
      }))
      .filter(row => row.linkedinAccountId)
  } catch {
    return []
  }
}

/** Aggregate today's SalesRobot daily stats into one row per LinkedIn account. */
export async function getLinkedInBdActivityForDay(
  day: Date | string = new Date()
): Promise<BdAccountActivityRow[]> {
  const key = businessDayKey(day)
  const dayStart = new Date(`${key}T00:00:00.000Z`)

  const [accounts, stats] = await Promise.all([
    prisma.salesRobotAccount.findMany({
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: {
        salesrobotAccountId: true,
        name: true,
        email: true,
      },
    }),
    prisma.salesRobotDailyStat.findMany({
      where: { date: dayStart },
      select: {
        linkedinAccountId: true,
        connectionRequestsSent: true,
        messagesSent: true,
        repliesReceived: true,
      },
    }),
  ])

  const byAccount = new Map<
    string,
    { newOutreach: number; followUps: number; replies: number }
  >()

  for (const row of stats) {
    const id = row.linkedinAccountId || ''
    if (!id) continue
    const current = byAccount.get(id) || { newOutreach: 0, followUps: 0, replies: 0 }
    current.newOutreach += row.connectionRequestsSent || 0
    current.followUps += row.messagesSent || 0
    current.replies += row.repliesReceived || 0
    byAccount.set(id, current)
  }

  return accounts.map(account => {
    const metrics = byAccount.get(account.salesrobotAccountId) || {
      newOutreach: 0,
      followUps: 0,
      replies: 0,
    }
    return {
      linkedinAccountId: account.salesrobotAccountId,
      accountName: account.name || account.email || account.salesrobotAccountId,
      newOutreach: metrics.newOutreach,
      followUps: metrics.followUps,
      replies: metrics.replies,
      meetingsBooked: 0,
      source: 'salesrobot' as const,
    }
  })
}

/** Prefer saved EOD values; fill missing accounts from live SalesRobot stats. */
export function mergeBdActivity(
  saved: BdAccountActivityRow[],
  live: BdAccountActivityRow[]
): BdAccountActivityRow[] {
  if (saved.length === 0) return live
  const savedById = new Map(saved.map(row => [row.linkedinAccountId, row]))
  const merged = live.map(liveRow => {
    const existing = savedById.get(liveRow.linkedinAccountId)
    if (!existing) return liveRow
    return {
      ...liveRow,
      newOutreach: existing.newOutreach,
      followUps: existing.followUps,
      replies: existing.replies,
      meetingsBooked: existing.meetingsBooked,
      source: existing.source,
    }
  })
  // Keep any saved rows for accounts no longer in SalesRobot list
  for (const row of saved) {
    if (!merged.some(m => m.linkedinAccountId === row.linkedinAccountId)) {
      merged.push(row)
    }
  }
  return merged
}
