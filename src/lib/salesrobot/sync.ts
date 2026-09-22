import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import {
  fetchAllPages,
  getDashboardDailyStats,
  isSalesRobotConfigured,
  listCampaigns,
  listLinkedInAccounts,
  listProspects,
  listSyncedMessages,
} from './client'
import { rebuildWeeklyFromDaily } from './analytics'
import {
  metricsFromCampaignDto,
  parseFlexibleDate,
  toDateOnlyIso,
} from './metrics'
import {
  attachSalesRobotSyncPromise,
  beginSalesRobotSync,
  failSalesRobotSync,
  getSalesRobotSyncStatus,
  isSalesRobotSyncRunning,
  type SalesRobotSyncMode,
} from './sync-status'
import type {
  SalesRobotApiAccount,
  SalesRobotApiCampaign,
  SalesRobotApiProspect,
  SalesRobotSyncedConversation,
} from './types'

function accountId(a: SalesRobotApiAccount) {
  return a.linkedinAccountUuid || a.uuid || ''
}

function accountName(a: SalesRobotApiAccount) {
  return (
    a.nameOnLinkedinAccount ||
    a.name ||
    a.fullName ||
    a.emailId ||
    a.email ||
    a.linkedinEmail ||
    accountId(a)
  )
}

function accountEmail(a: SalesRobotApiAccount) {
  return a.emailId || a.email || a.linkedinEmail || null
}

function accountLicence(a: SalesRobotApiAccount) {
  return a.licenceStatus || a.subscription || a.paymentStatus || null
}

function campaignUuid(c: SalesRobotApiCampaign) {
  return c.uuid || ''
}

function prospectUuid(p: SalesRobotApiProspect) {
  return p.prospectUuid || p.uuid || (p.id != null ? String(p.id) : '')
}

function activityLooksReplied(activity: string | null | undefined) {
  const value = (activity || '').toUpperCase()
  return value.includes('REPLIED')
}

function isTrulyReplied(p: SalesRobotApiProspect) {
  if (p.isReplied === true || p.isEmailReplied === true) return true
  if (p.firstReplyAt) return true
  if (activityLooksReplied(p.lastActivity)) return true
  if ((p.stepExportData || []).some(step => Boolean(step.repliedAt))) return true
  return false
}

function repliedAtFromProspect(p: SalesRobotApiProspect): Date | null {
  const fromFirst = parseFlexibleDate(p.firstReplyAt)
  if (fromFirst) return fromFirst

  const stepDates = (p.stepExportData || [])
    .map(step => parseFlexibleDate(step.repliedAt))
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())
  return stepDates[0] ?? null
}

function lastInboundFromConversation(conversation: SalesRobotSyncedConversation) {
  const messages = conversation.threadedMessages?.messages || []
  const inbound = messages.filter(m => m.messageSentByMe === false && m.messageText?.trim())
  if (!inbound.length) return null
  const last = inbound[inbound.length - 1]
  return {
    text: (last.messageText || '').trim().slice(0, 2000),
    at: parseFlexibleDate(last.sentTime),
  }
}

async function upsertAccount(a: SalesRobotApiAccount) {
  const id = accountId(a)
  if (!id) return null
  return prisma.salesRobotAccount.upsert({
    where: { salesrobotAccountId: id },
    create: {
      salesrobotAccountId: id,
      name: accountName(a),
      email: accountEmail(a),
      healthStatus: a.healthStatus || null,
      licenceStatus: accountLicence(a),
      lastSyncedAt: new Date(),
    },
    update: {
      name: accountName(a),
      email: accountEmail(a),
      healthStatus: a.healthStatus || null,
      licenceStatus: accountLicence(a),
      lastSyncedAt: new Date(),
    },
  })
}

async function upsertCampaign(c: SalesRobotApiCampaign, linkedinAccountId: string) {
  const id = campaignUuid(c)
  if (!id) return null
  return prisma.salesRobotCampaign.upsert({
    where: { salesrobotCampaignId: id },
    create: {
      salesrobotCampaignId: id,
      name: c.name || id,
      linkedinAccountId: linkedinAccountId || null,
      status: c.campaignStatus || null,
      source: c.source || null,
      isArchived: Boolean(c.isArchived),
      totalProspectCount: c.totalProspectCount ?? c.prospectsAdded ?? 0,
      lastSyncedAt: new Date(),
    },
    update: {
      name: c.name || id,
      linkedinAccountId: linkedinAccountId || null,
      status: c.campaignStatus || null,
      source: c.source || null,
      isArchived: Boolean(c.isArchived),
      totalProspectCount: c.totalProspectCount ?? c.prospectsAdded ?? 0,
      lastSyncedAt: new Date(),
    },
  })
}

async function upsertProspect(
  p: SalesRobotApiProspect,
  linkedinAccountId: string,
  campaignLocalId: string | null,
  salesrobotCampaignId: string,
  extras?: {
    lastClientMessage?: string | null
    lastClientMessageAt?: Date | null
  }
) {
  const id = prospectUuid(p)
  if (!id) return null

  const isReplied = isTrulyReplied(p)
  const isConnected = Boolean(p.isConnected)
  const apiRepliedAt =
    repliedAtFromProspect(p) || extras?.lastClientMessageAt || null
  const lastClientMessage = extras?.lastClientMessage?.trim() || null
  const lastClientMessageAt = extras?.lastClientMessageAt || null

  return prisma.salesRobotProspect.upsert({
    where: { salesrobotProspectId: id },
    create: {
      salesrobotProspectId: id,
      campaignId: campaignLocalId ?? undefined,
      salesrobotCampaignId,
      linkedinAccountId: p.linkedinAccountUuid || linkedinAccountId || null,
      linkedinUrl: p.profileUrl || null,
      firstName: p.firstName || null,
      lastName: p.lastName || null,
      company: p.companyName || null,
      jobTitle: p.jobTitle || null,
      status: p.lastActivity || null,
      isConnected,
      isReplied,
      addedAt: parseFlexibleDate(p.createdTime),
      connectionRequestedAt: parseFlexibleDate(p.connectionRequestSentAt),
      connectedAt: isConnected
        ? parseFlexibleDate(p.connectionAcceptedAt) || new Date()
        : parseFlexibleDate(p.connectionAcceptedAt),
      repliedAt: isReplied ? apiRepliedAt : null,
      lastClientMessage,
      lastClientMessageAt,
    },
    update: {
      campaignId: campaignLocalId ?? undefined,
      salesrobotCampaignId,
      linkedinAccountId: p.linkedinAccountUuid || linkedinAccountId || null,
      linkedinUrl: p.profileUrl || null,
      firstName: p.firstName || null,
      lastName: p.lastName || null,
      company: p.companyName || null,
      jobTitle: p.jobTitle || null,
      status: p.lastActivity || undefined,
      isConnected,
      isReplied,
      connectionRequestedAt: parseFlexibleDate(p.connectionRequestSentAt) ?? undefined,
      connectedAt: isConnected
        ? parseFlexibleDate(p.connectionAcceptedAt) || undefined
        : undefined,
      // Only set when we know the real reply time — never stamp "now"
      repliedAt: apiRepliedAt ?? undefined,
      lastClientMessage: lastClientMessage ?? undefined,
      lastClientMessageAt: lastClientMessageAt ?? undefined,
    },
  })
}

async function syncRepliedProspectsForCampaign(
  linkedinAccountId: string,
  campaignLocalId: string,
  salesrobotCampaignId: string,
  maxPages: number
) {
  let count = 0
  const repliedIds: string[] = []

  for (let page = 0; page < maxPages; page++) {
    const prospects = await listProspects(linkedinAccountId, salesrobotCampaignId, page, 100, {
      lastActivityList: ['REPLIED', 'REPLIED_AFTER_UNPAUSING'],
    })

    for (const prospect of prospects.items) {
      // API filter is unreliable — only keep truly replied people
      if (!isTrulyReplied(prospect)) continue
      const saved = await upsertProspect(
        { ...prospect, isReplied: true },
        linkedinAccountId,
        campaignLocalId,
        salesrobotCampaignId
      )
      if (saved) {
        repliedIds.push(saved.salesrobotProspectId)
        count += 1
      }
    }

    if (page + 1 >= prospects.totalPages || prospects.items.length === 0) break
  }

  // Clear false positives from earlier syncs that stamped whole pages as replied/"Today"
  await prisma.salesRobotProspect.updateMany({
    where: {
      salesrobotCampaignId,
      isReplied: true,
      ...(repliedIds.length ? { salesrobotProspectId: { notIn: repliedIds } } : {}),
      lastClientMessage: null,
      OR: [{ status: null }, { status: { not: { contains: 'REPLIED' } } }],
      repliedAt: { gte: subDays(new Date(), 3) },
    },
    data: { isReplied: false },
  })

  return count
}

/** Pull inbox threads that have a client reply — source of truth for Waiting for us. */
async function syncInboxMessagesForAccount(
  linkedinAccountId: string,
  options: { unreadPages?: number; allPages?: number } = {}
) {
  let updated = 0
  const unreadPages = options.unreadPages ?? 3
  const allPages = options.allPages ?? 0
  const campaignCache = new Map<string, string | null>()

  const modes: Array<{ unreadOnly: boolean; pages: number }> = [
    { unreadOnly: true, pages: unreadPages },
  ]
  if (allPages > 0) {
    modes.push({ unreadOnly: false, pages: allPages })
  }

  for (const mode of modes) {
    for (let page = 0; page < mode.pages; page++) {
      const result = await listSyncedMessages(linkedinAccountId, {
        page,
        size: 50,
        unreadOnly: mode.unreadOnly,
      })

      for (const conversation of result.items) {
        const prospect = conversation.prospectData
        if (!prospect) continue
        // Only keep threads where the client actually wrote something
        const inbound = lastInboundFromConversation(conversation)
        if (!inbound) continue

        const campaignId = prospect.campaignUuid || conversation.campaignUuid
        if (!campaignId) continue

        let campaignLocalId = campaignCache.get(campaignId)
        if (campaignLocalId === undefined) {
          const campaign = await prisma.salesRobotCampaign.findUnique({
            where: { salesrobotCampaignId: campaignId },
            select: { id: true },
          })
          campaignLocalId = campaign?.id ?? null
          campaignCache.set(campaignId, campaignLocalId)
        }

        await upsertProspect(
          {
            ...prospect,
            isReplied: true,
            firstReplyAt:
              prospect.firstReplyAt || inbound.at?.toISOString() || undefined,
          },
          conversation.linkedinAccountUuid || linkedinAccountId,
          campaignLocalId,
          campaignId,
          { lastClientMessage: inbound.text, lastClientMessageAt: inbound.at }
        )
        updated += 1
      }

      if (page + 1 >= result.totalPages || result.items.length === 0) break
    }
  }

  return updated
}

/** Drop bogus "waiting" rows that have no client message (old sync bug). */
async function clearFalseWaitingProspects() {
  const cleared = await prisma.salesRobotProspect.updateMany({
    where: {
      isReplied: true,
      followUpCompletedAt: null,
      lastClientMessage: null,
    },
    data: { isReplied: false },
  })
  return cleared.count
}

async function persistDailyStats(
  linkedinAccountId: string,
  days: { date?: string; campaignDTOList?: SalesRobotApiCampaign[] }[]
) {
  let rows = 0
  for (const day of days) {
    const date = parseFlexibleDate(day.date)
    if (!date) continue
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

    for (const campaign of day.campaignDTOList ?? []) {
      const salesrobotCampaignId = campaignUuid(campaign)
      if (!salesrobotCampaignId) continue
      const metrics = metricsFromCampaignDto(campaign)

      await prisma.salesRobotDailyStat.upsert({
        where: {
          date_salesrobotCampaignId_linkedinAccountId: {
            date: dayStart,
            salesrobotCampaignId,
            linkedinAccountId: linkedinAccountId || '',
          },
        },
        create: {
          date: dayStart,
          salesrobotCampaignId,
          campaignName: campaign.name || null,
          linkedinAccountId: linkedinAccountId || '',
          ...metrics,
          viewedCount: campaign.viewedCount ?? 0,
          rawPayload: JSON.stringify(campaign),
        },
        update: {
          campaignName: campaign.name || null,
          ...metrics,
          viewedCount: campaign.viewedCount ?? 0,
          rawPayload: JSON.stringify(campaign),
        },
      })

      rows += 1
    }
  }
  return rows
}

export type SyncResult = {
  ok: boolean
  configured: boolean
  accounts: number
  campaigns: number
  prospects: number
  dailyRows: number
  weeksRebuilt: number
  errors: string[]
}

/** Start sync in the background and return immediately (UI can keep navigating). */
export function startSalesRobotSync(options?: {
  daysBack?: number
  syncProspects?: boolean
  syncRepliedProspects?: boolean
  maxProspectPagesPerCampaign?: number
}): { started: boolean; status: ReturnType<typeof getSalesRobotSyncStatus> } {
  const mode: SalesRobotSyncMode = options?.syncProspects ? 'full' : 'quick'
  const began = beginSalesRobotSync(mode)
  if (!began.started) return began

  if (!isSalesRobotConfigured()) {
    failSalesRobotSync('SALESROBOT_API_KEY is not configured')
    return { started: false, status: getSalesRobotSyncStatus() }
  }

  const promise = runSalesRobotSyncInner(options)
  attachSalesRobotSyncPromise(promise)
  return began
}

/** Await the sync (cron / scripts). Uses the same lock as background sync. */
export async function runSalesRobotSync(options?: {
  daysBack?: number
  syncProspects?: boolean
  syncRepliedProspects?: boolean
  maxProspectPagesPerCampaign?: number
}): Promise<SyncResult> {
  if (isSalesRobotSyncRunning()) {
    return {
      ok: false,
      configured: isSalesRobotConfigured(),
      accounts: 0,
      campaigns: 0,
      prospects: 0,
      dailyRows: 0,
      weeksRebuilt: 0,
      errors: ['Sync already in progress — wait for it to finish or restart the dev server'],
    }
  }

  const mode: SalesRobotSyncMode = options?.syncProspects ? 'full' : 'quick'
  beginSalesRobotSync(mode)
  const promise = runSalesRobotSyncInner(options)
  attachSalesRobotSyncPromise(promise)
  return promise
}

export { getSalesRobotSyncStatus, isSalesRobotSyncRunning }

async function runSalesRobotSyncInner(options?: {
  daysBack?: number
  syncProspects?: boolean
  syncRepliedProspects?: boolean
  maxProspectPagesPerCampaign?: number
}): Promise<SyncResult> {
  const result: SyncResult = {
    ok: false,
    configured: isSalesRobotConfigured(),
    accounts: 0,
    campaigns: 0,
    prospects: 0,
    dailyRows: 0,
    weeksRebuilt: 0,
    errors: [],
  }

  if (!result.configured) {
    result.errors.push('SALESROBOT_API_KEY is not configured')
    return result
  }

  const daysBack = options?.daysBack ?? 42
  // Sync now  = campaigns + stats + recent unread inbox (fast)
  // Full sync = + deeper inbox + campaign replied scan (slower, better messages)
  const syncProspectLists = Boolean(options?.syncProspects)
  const syncRepliedFromCampaigns = syncProspectLists
  const end = new Date()
  const start = subDays(end, daysBack)
  const startDate = toDateOnlyIso(start)
  const endDate = toDateOnlyIso(end)

  try {
    // Remove stale false-positive "Waiting for us" rows from the slow sync bug
    try {
      const cleared = await clearFalseWaitingProspects()
      if (cleared > 0) {
        console.info('[salesrobot] cleared false waiting prospects', { cleared })
      }
    } catch (err) {
      result.errors.push(
        `clear waiting: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    const accounts = await fetchAllPages(page => listLinkedInAccounts(page, 50))
    for (const account of accounts) {
      try {
        await upsertAccount(account)
        result.accounts += 1
      } catch (err) {
        result.errors.push(`account upsert: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const accountIds = [...new Set(accounts.map(accountId).filter(Boolean))]
    // Also include previously stored accounts if API list is empty/partial
    if (accountIds.length === 0) {
      const stored = await prisma.salesRobotAccount.findMany({ select: { salesrobotAccountId: true } })
      accountIds.push(...stored.map(a => a.salesrobotAccountId))
    }

    console.info('[salesrobot] sync accounts', {
      count: accountIds.length,
      startDate,
      endDate,
      syncProspectLists,
      syncRepliedFromCampaigns,
    })

    for (const linkedinAccountId of accountIds) {
      try {
        console.info('[salesrobot] syncing account', { linkedinAccountId })
        const campaigns = await fetchAllPages(page => listCampaigns(linkedinAccountId, page, 50))
        for (const campaign of campaigns) {
          const saved = await upsertCampaign(campaign, linkedinAccountId)
          if (saved) result.campaigns += 1
        }

        const maxPages = options?.maxProspectPagesPerCampaign ?? 3

        // Optional: also scan campaign replied lists (Full sync only). Messages still come from inbox.
        if (syncRepliedFromCampaigns) {
          for (const campaign of campaigns) {
            const id = campaignUuid(campaign)
            if (!id) continue
            const saved = await prisma.salesRobotCampaign.findUnique({
              where: { salesrobotCampaignId: id },
            })
            if (!saved) continue

            try {
              result.prospects += await syncRepliedProspectsForCampaign(
                linkedinAccountId,
                saved.id,
                saved.salesrobotCampaignId,
                maxPages
              )
            } catch (err) {
              result.errors.push(
                `replied prospects ${saved.salesrobotCampaignId}: ${
                  err instanceof Error ? err.message : String(err)
                }`
              )
            }
          }
        }

        // Inbox is the source of truth for client last message + waiting list
        try {
          result.prospects += await syncInboxMessagesForAccount(linkedinAccountId, {
            // Sync now: recent unread only. Full sync: deeper unread + older threads.
            unreadPages: syncProspectLists ? 20 : 3,
            allPages: syncProspectLists ? 8 : 0,
          })
        } catch (err) {
          result.errors.push(
            `inbox ${linkedinAccountId}: ${err instanceof Error ? err.message : String(err)}`
          )
        }

        const stats = await getDashboardDailyStats({
          linkedinAccountUuid: linkedinAccountId,
          startDate,
          endDate,
          allCampaigns: true,
        })
        const dailyRows = await persistDailyStats(linkedinAccountId, stats.data ?? [])
        result.dailyRows += dailyRows
        console.info('[salesrobot] account synced', {
          linkedinAccountId,
          campaigns: campaigns.length,
          dailyRows,
          prospects: result.prospects,
        })
      } catch (err) {
        result.errors.push(
          `account ${linkedinAccountId}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    const rebuilt = await rebuildWeeklyFromDaily({ from: start, to: end })
    result.weeksRebuilt = rebuilt.weeks
    result.ok = result.errors.length === 0
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err))
  }

  return result
}
