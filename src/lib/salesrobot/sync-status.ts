import { prisma } from '@/lib/prisma'

export type SyncResultSummary = {
  ok: boolean
  configured: boolean
  accounts: number
  campaigns: number
  prospects: number
  dailyRows: number
  weeksRebuilt: number
  errors: string[]
}

export type SalesRobotSyncMode = 'quick' | 'full'

export type SalesRobotSyncState = {
  state: 'idle' | 'running' | 'done' | 'error'
  mode: SalesRobotSyncMode | null
  startedAt: string | null
  finishedAt: string | null
  lastSyncedAt: string | null
  message: string | null
  result: SyncResultSummary | null
}

const JOB_ID = 'default'

type MemoryStore = {
  inFlight: Promise<SyncResultSummary> | null
}

const globalForSync = globalThis as unknown as {
  __salesRobotSyncMemory?: MemoryStore
}

function memory(): MemoryStore {
  if (!globalForSync.__salesRobotSyncMemory) {
    globalForSync.__salesRobotSyncMemory = { inFlight: null }
  }
  return globalForSync.__salesRobotSyncMemory
}

function toState(row: {
  state: string
  mode: string | null
  startedAt: Date | null
  finishedAt: Date | null
  lastSyncedAt: Date | null
  message: string | null
  resultJson: string | null
}): SalesRobotSyncState {
  let result: SyncResultSummary | null = null
  if (row.resultJson) {
    try {
      result = JSON.parse(row.resultJson) as SyncResultSummary
    } catch {
      result = null
    }
  }
  return {
    state: (['idle', 'running', 'done', 'error'].includes(row.state)
      ? row.state
      : 'idle') as SalesRobotSyncState['state'],
    mode: row.mode === 'full' || row.mode === 'quick' ? row.mode : null,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    message: row.message,
    result,
  }
}

async function ensureJob() {
  return prisma.salesRobotSyncJob.upsert({
    where: { id: JOB_ID },
    create: { id: JOB_ID, state: 'idle' },
    update: {},
  })
}

export async function getSalesRobotSyncStatus(): Promise<SalesRobotSyncState> {
  try {
    const row = await ensureJob()
    return toState(row)
  } catch {
    return {
      state: memory().inFlight ? 'running' : 'idle',
      mode: null,
      startedAt: null,
      finishedAt: null,
      lastSyncedAt: null,
      message: memory().inFlight ? 'Sync running…' : null,
      result: null,
    }
  }
}

export async function isSalesRobotSyncRunning() {
  if (memory().inFlight) return true
  try {
    const row = await ensureJob()
    return row.state === 'running'
  } catch {
    return Boolean(memory().inFlight)
  }
}

export async function beginSalesRobotSync(mode: SalesRobotSyncMode): Promise<{
  started: boolean
  status: SalesRobotSyncState
}> {
  if (memory().inFlight) {
    return {
      started: false,
      status: {
        ...(await getSalesRobotSyncStatus()),
        message: 'Sync already running in the background',
      },
    }
  }

  const existing = await ensureJob()
  if (existing.state === 'running' && existing.startedAt) {
    const ageMs = Date.now() - existing.startedAt.getTime()
    // Stale lock from a killed serverless function — allow restart after 12 min
    if (ageMs < 12 * 60 * 1000) {
      return {
        started: false,
        status: {
          ...toState(existing),
          message: existing.message || 'Sync already running in the background',
        },
      }
    }
  }

  const startedAt = new Date()
  const message =
    mode === 'full' ? 'Full sync running in background…' : 'Sync running in background…'
  const row = await prisma.salesRobotSyncJob.upsert({
    where: { id: JOB_ID },
    create: {
      id: JOB_ID,
      state: 'running',
      mode,
      startedAt,
      finishedAt: null,
      message,
      resultJson: null,
    },
    update: {
      state: 'running',
      mode,
      startedAt,
      finishedAt: null,
      message,
      resultJson: null,
    },
  })

  return { started: true, status: toState(row) }
}

export function attachSalesRobotSyncPromise(promise: Promise<SyncResultSummary>) {
  const mem = memory()
  mem.inFlight = promise
  void promise
    .then(async result => {
      const finishedAt = new Date()
      const ok = result.ok || result.campaigns > 0 || result.dailyRows > 0 || result.prospects > 0
      const current = await ensureJob().catch(() => null)
      const mode = current?.mode === 'full' ? 'full' : current?.mode === 'quick' ? 'quick' : null
      const message = ok
        ? mode === 'full'
          ? 'Full sync done'
          : 'Sync done'
        : result.errors[0] || 'Sync finished with errors'
      await prisma.salesRobotSyncJob.upsert({
        where: { id: JOB_ID },
        create: {
          id: JOB_ID,
          state: ok ? 'done' : 'error',
          mode,
          finishedAt,
          lastSyncedAt: finishedAt,
          message,
          resultJson: JSON.stringify(result),
        },
        update: {
          state: ok ? 'done' : 'error',
          finishedAt,
          lastSyncedAt: finishedAt,
          message,
          resultJson: JSON.stringify(result),
        },
      })
    })
    .catch(async err => {
      const finishedAt = new Date()
      await prisma.salesRobotSyncJob.upsert({
        where: { id: JOB_ID },
        create: {
          id: JOB_ID,
          state: 'error',
          finishedAt,
          message: err instanceof Error ? err.message : 'Sync failed',
        },
        update: {
          state: 'error',
          finishedAt,
          message: err instanceof Error ? err.message : 'Sync failed',
        },
      })
    })
    .finally(() => {
      mem.inFlight = null
    })
}

export async function failSalesRobotSync(message: string) {
  const finishedAt = new Date()
  memory().inFlight = null
  await prisma.salesRobotSyncJob.upsert({
    where: { id: JOB_ID },
    create: {
      id: JOB_ID,
      state: 'error',
      finishedAt,
      message,
    },
    update: {
      state: 'error',
      finishedAt,
      message,
    },
  })
}
