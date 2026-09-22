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

type SyncStore = {
  status: SalesRobotSyncState
  inFlight: Promise<SyncResultSummary> | null
}

const globalForSync = globalThis as unknown as {
  __salesRobotSyncStore?: SyncStore
}

function store(): SyncStore {
  if (!globalForSync.__salesRobotSyncStore) {
    globalForSync.__salesRobotSyncStore = {
      inFlight: null,
      status: {
        state: 'idle',
        mode: null,
        startedAt: null,
        finishedAt: null,
        lastSyncedAt: null,
        message: null,
        result: null,
      },
    }
  }
  return globalForSync.__salesRobotSyncStore
}

export function getSalesRobotSyncStatus(): SalesRobotSyncState {
  return { ...store().status }
}

export function isSalesRobotSyncRunning() {
  return store().status.state === 'running' || Boolean(store().inFlight)
}

function setStatus(patch: Partial<SalesRobotSyncState>) {
  store().status = { ...store().status, ...patch }
}

export function beginSalesRobotSync(mode: SalesRobotSyncMode): {
  started: boolean
  status: SalesRobotSyncState
} {
  const s = store()
  if (s.inFlight || s.status.state === 'running') {
    return {
      started: false,
      status: {
        ...getSalesRobotSyncStatus(),
        message: s.status.message || 'Sync already running in the background',
      },
    }
  }

  const startedAt = new Date().toISOString()
  setStatus({
    state: 'running',
    mode,
    startedAt,
    finishedAt: null,
    message: mode === 'full' ? 'Full sync running in background…' : 'Sync running in background…',
    result: null,
  })

  return { started: true, status: getSalesRobotSyncStatus() }
}

export function failSalesRobotSync(message: string) {
  setStatus({
    state: 'error',
    finishedAt: new Date().toISOString(),
    message,
    result: null,
  })
  store().inFlight = null
}

export function attachSalesRobotSyncPromise(promise: Promise<SyncResultSummary>) {
  const s = store()
  s.inFlight = promise
  void promise
    .then(result => {
      const finishedAt = new Date().toISOString()
      const ok = result.ok || result.campaigns > 0 || result.dailyRows > 0 || result.prospects > 0
      const mode = s.status.mode
      setStatus({
        state: ok ? 'done' : 'error',
        finishedAt,
        lastSyncedAt: finishedAt,
        message: ok
          ? mode === 'full'
            ? 'Full sync done'
            : 'Sync done'
          : result.errors[0] || 'Sync finished with errors',
        result,
      })
    })
    .catch(err => {
      const finishedAt = new Date().toISOString()
      setStatus({
        state: 'error',
        finishedAt,
        message: err instanceof Error ? err.message : 'Sync failed',
        result: null,
      })
    })
    .finally(() => {
      s.inFlight = null
    })
}
