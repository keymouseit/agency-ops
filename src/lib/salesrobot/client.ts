import type {
  SalesRobotApiAccount,
  SalesRobotApiCampaign,
  SalesRobotApiProspect,
  SalesRobotDailyActivity,
  SalesRobotSyncedConversation,
} from './types'

export class SalesRobotApiError extends Error {
  status: number
  body: string

  constructor(message: string, status: number, body: string) {
    super(message)
    this.name = 'SalesRobotApiError'
    this.status = status
    this.body = body
  }

  get isRetryable() {
    return this.status === 429 || this.status >= 500
  }
}

type QueryValue = string | number | boolean | null | undefined | QueryValue[] | { [key: string]: QueryValue }

function flattenQuery(prefix: string, value: QueryValue, out: URLSearchParams) {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenQuery(`${prefix}[${index}]`, item, out))
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flattenQuery(prefix ? `${prefix}.${k}` : k, v, out)
    }
    return
  }
  out.append(prefix, String(value))
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isSalesRobotConfigured() {
  return Boolean(process.env.SALESROBOT_API_KEY?.trim())
}

export function getSalesRobotConfig() {
  const apiKey = process.env.SALESROBOT_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('SALESROBOT_API_KEY is not configured')
  }
  const baseUrl = (process.env.SALESROBOT_API_BASE_URL || 'https://api.boomtechinc.com').replace(/\/$/, '')
  return { apiKey, baseUrl }
}

async function salesRobotFetch<T>(
  path: string,
  options: {
    method?: string
    query?: Record<string, QueryValue>
    body?: unknown
    retries?: number
  } = {}
): Promise<T> {
  const { apiKey, baseUrl } = getSalesRobotConfig()
  const method = options.method ?? 'GET'
  const retries = options.retries ?? 3
  const params = new URLSearchParams()
  if (options.query) flattenQuery('', options.query, params)

  const url = `${baseUrl}${path}${params.toString() ? `?${params}` : ''}`
  let lastError: SalesRobotApiError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now()
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          Authorization: apiKey,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        cache: 'no-store',
      })

      const text = await res.text()
      const durationMs = Date.now() - started
      console.info('[salesrobot]', {
        integration: 'salesrobot',
        method,
        path,
        http_status: res.status,
        duration_ms: durationMs,
        attempt,
      })

      if (!res.ok) {
        lastError = new SalesRobotApiError(
          `SalesRobot API ${method} ${path} failed (${res.status})`,
          res.status,
          text.slice(0, 2000)
        )
        if (lastError.isRetryable && attempt < retries) {
          await sleep(Math.min(8000, 500 * 2 ** attempt))
          continue
        }
        throw lastError
      }

      if (!text) return {} as T
      return JSON.parse(text) as T
    } catch (err) {
      if (err instanceof SalesRobotApiError) throw err
      lastError = new SalesRobotApiError(
        err instanceof Error ? err.message : 'SalesRobot network error',
        0,
        ''
      )
      if (attempt < retries) {
        await sleep(Math.min(8000, 500 * 2 ** attempt))
        continue
      }
      throw lastError
    }
  }

  throw lastError ?? new SalesRobotApiError('SalesRobot request failed', 500, '')
}

function unwrapList<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const data = root.data
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const page = data as Record<string, unknown>
    if (Array.isArray(page.data)) return page.data as T[]
    if (Array.isArray(page.content)) return page.content as T[]
  }
  if (Array.isArray(root.content)) return root.content as T[]
  return []
}

function unwrapPageMeta(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return { currentPage: 0, totalPages: 1 }
  }
  const root = payload as Record<string, unknown>
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>
  return {
    currentPage: Number(data.currentPage ?? 0),
    totalPages: Math.max(1, Number(data.totalPages ?? 1)),
  }
}

export async function listLinkedInAccounts(page = 0, size = 50) {
  const payload = await salesRobotFetch<unknown>('/api/linkedinAccounts', {
    query: {
      p: { page, size },
      params: {},
    },
  })
  return {
    items: unwrapList<SalesRobotApiAccount>(payload),
    ...unwrapPageMeta(payload),
  }
}

export async function listCampaigns(linkedinAccountUuid: string, page = 0, size = 50) {
  const payload = await salesRobotFetch<unknown>('/api/campaigns', {
    query: {
      linkedinAccountUuid,
      p: { page, size },
      params: { isArchived: false },
    },
  })
  return {
    items: unwrapList<SalesRobotApiCampaign>(payload),
    ...unwrapPageMeta(payload),
  }
}

export async function listProspects(
  linkedinAccountUuid: string,
  campaignUuid: string,
  page = 0,
  size = 100,
  searchParams: Record<string, QueryValue> = {}
) {
  const payload = await salesRobotFetch<unknown>('/api/campaign/prospects', {
    query: {
      linkedinAccountUuid,
      campaignUuid,
      p: { page, size },
      params: searchParams,
    },
  })
  return {
    items: unwrapList<SalesRobotApiProspect>(payload),
    ...unwrapPageMeta(payload),
  }
}

/** Inbox conversations (includes threaded messages + prospect reply state). */
export async function listSyncedMessages(
  linkedinAccountUuid: string,
  options: {
    page?: number
    size?: number
    campaignUuid?: string
    unreadOnly?: boolean
  } = {}
) {
  const page = options.page ?? 0
  const size = options.size ?? 50
  const payload = await salesRobotFetch<{
    success?: boolean
    data?: Array<{
      data?: SalesRobotSyncedConversation[] | null
      currentPage?: number
      totalPages?: number
    }>
  }>('/api/syncedMessages', {
    method: 'POST',
    query: {
      linkedinAccountUuid,
      page,
      size,
    },
    body: {
      campaignUuid: options.campaignUuid ?? 'ALL',
      ...(options.unreadOnly ? { isUnread: true } : {}),
    },
  })

  const blocks = Array.isArray(payload.data) ? payload.data : []
  const pageBlock =
    blocks.find(b => Array.isArray(b.data)) ||
    blocks.find(b => typeof b.totalPages === 'number') ||
    blocks[0]
  const items = Array.isArray(pageBlock?.data) ? pageBlock.data : []
  return {
    items,
    currentPage: Number(pageBlock?.currentPage ?? page),
    totalPages: Math.max(1, Number(pageBlock?.totalPages ?? 1)),
  }
}

export async function getCampaignTimeStats(linkedinAccountUuid: string, campaignUuid: string) {
  return salesRobotFetch<{ success?: boolean; data?: SalesRobotApiCampaign }>(
    '/api/campaignTimeWiseStats',
    {
      query: { linkedinAccountUuid, campaignUuid },
    }
  )
}

export async function getDashboardDailyStats(input: {
  linkedinAccountUuid: string
  startDate: string
  endDate: string
  campaignUuids?: string[]
  allCampaigns?: boolean
  allAccounts?: boolean
}) {
  return salesRobotFetch<{ success?: boolean; data?: SalesRobotDailyActivity[] }>(
    '/api/campaign/stats',
    {
      method: 'POST',
      query: { linkedinAccountUuid: input.linkedinAccountUuid },
      body: {
        startDate: input.startDate,
        endDate: input.endDate,
        campaignUuids: input.campaignUuids,
        allCampaigns: input.allCampaigns ?? !input.campaignUuids?.length,
        allAccounts: input.allAccounts ?? false,
        linkedinAccounts: [input.linkedinAccountUuid],
      },
    }
  )
}

export async function fetchAllPages<T>(
  loader: (page: number) => Promise<{ items: T[]; totalPages: number }>,
  maxPages = 20
) {
  const all: T[] = []
  let page = 0
  let totalPages = 1
  while (page < totalPages && page < maxPages) {
    const result = await loader(page)
    all.push(...result.items)
    totalPages = Number.isFinite(result.totalPages) ? result.totalPages : 1
    page += 1
    if (result.items.length === 0) break
  }
  return all
}
