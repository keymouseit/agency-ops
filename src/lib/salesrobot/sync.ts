import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import {
  fetchAllPages,
  getDashboardDailyStats,
  isSalesRobotConfigured,
  listCampaigns,
  listLinkedInAccounts,
  listProspects,
} from './client'
import { rebuildWeeklyFromDaily } from './analytics'
import {
  metricsFromCampaignDto,
  parseFlexibleDate,
  toDateOnlyIso,
} from './metrics'
import type { SalesRobotApiAccount, SalesRobotApiCampaign, SalesRobotApiProspect } from './types'

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
  salesrobotCampaignId: string
) {
  const id = prospectUuid(p)
  if (!id) return null
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
      isConnected: Boolean(p.isConnected),
      isReplied: Boolean(p.isReplied),
      addedAt: parseFlexibleDate(p.createdTime),
      connectedAt: p.isConnected ? new Date() : null,
      repliedAt: p.isReplied ? new Date() : null,
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
      isConnected: Boolean(p.isConnected),
      isReplied: Boolean(p.isReplied),
      connectedAt: p.isConnected ? new Date() : null,
      repliedAt: p.isReplied ? new Date() : null,
    },
  })
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

export async function runSalesRobotSync(options?: {
  daysBack?: number
  syncProspects?: boolean
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
  const end = new Date()
  const start = subDays(end, daysBack)
  const startDate = toDateOnlyIso(start)
  const endDate = toDateOnlyIso(end)

  try {
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

    console.info('[salesrobot] sync accounts', { count: accountIds.length, startDate, endDate })

    for (const linkedinAccountId of accountIds) {
      try {
        console.info('[salesrobot] syncing account', { linkedinAccountId })
        const campaigns = await fetchAllPages(page => listCampaigns(linkedinAccountId, page, 50))
        for (const campaign of campaigns) {
          const saved = await upsertCampaign(campaign, linkedinAccountId)
          if (saved) result.campaigns += 1
        }

        if (options?.syncProspects) {
          const maxPages = options.maxProspectPagesPerCampaign ?? 3
          for (const campaign of campaigns) {
            const id = campaignUuid(campaign)
            if (!id) continue
            const saved = await prisma.salesRobotCampaign.findUnique({
              where: { salesrobotCampaignId: id },
            })
            if (!saved) continue
            for (let page = 0; page < maxPages; page++) {
              const prospects = await listProspects(linkedinAccountId, saved.salesrobotCampaignId, page, 100)
              for (const prospect of prospects.items) {
                await upsertProspect(
                  prospect,
                  linkedinAccountId,
                  saved.id,
                  saved.salesrobotCampaignId
                )
                result.prospects += 1
              }
              if (page + 1 >= prospects.totalPages || prospects.items.length === 0) break
            }
          }
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
