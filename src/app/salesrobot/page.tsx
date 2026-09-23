import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fmtDate, fmtDateTime } from '@/lib/utils'
import {
  formatRatePercent,
  getAnalyticsDashboard,
  isSalesRobotConfigured,
  resolveDateRange,
} from '@/lib/salesrobot'
import SalesRobotFilters from './SalesRobotFilters'
import SalesRobotSyncButton from './SalesRobotSyncButton'
import SalesRobotCharts from './SalesRobotCharts'
import SalesRobotClientShell from './SalesRobotClientShell'
import {
  SalesRobotCampaignTable,
  SalesRobotKpiGrid,
  SalesRobotWeeklyTable,
} from './SalesRobotTables'
import SalesRobotWaitingList from './SalesRobotWaitingList'
import SalesRobotTabs from './SalesRobotTabs'
import { resolveSalesRobotTab } from './salesrobot-tabs'
import { WaitingCountProvider } from './WaitingCountContext'

export const dynamic = 'force-dynamic'

export default async function SalesRobotPage({
  searchParams,
}: {
  searchParams: {
    preset?: string
    from?: string
    to?: string
    campaignId?: string
    accountId?: string
    status?: string
    tab?: string
    waitingPage?: string
  }
}) {
  const session = await auth()
  const role = session?.user?.role
  const canSync =
    role === 'Founder' || role === 'Manager' || role === 'BD' || role === 'Both'
  const configured = isSalesRobotConfigured()
  const activeTab = resolveSalesRobotTab(searchParams.tab)

  const range = resolveDateRange({
    preset: searchParams.preset,
    from: searchParams.from,
    to: searchParams.to,
  })

  const requestedWaitingPage = Math.max(1, Math.floor(Number(searchParams.waitingPage) || 1))

  const data = await getAnalyticsDashboard({
    from: range.from,
    to: range.to,
    campaignId: searchParams.campaignId || null,
    linkedinAccountId: searchParams.accountId || null,
    status: searchParams.status || null,
    waitingPage: requestedWaitingPage,
  })

  const waitingRows = (data.waitingForUs ?? []).map(p => ({
    id: p.id,
    name: p.name,
    company: p.company,
    jobTitle: p.jobTitle,
    linkedinUrl: p.linkedinUrl,
    campaignName: p.campaignName,
    accountName: p.accountName,
    repliedAt: p.repliedAt ? p.repliedAt.toISOString() : null,
    lastClientMessage: p.lastClientMessage ?? null,
    lastClientMessageAt: p.lastClientMessageAt ? p.lastClientMessageAt.toISOString() : null,
    isConnected: p.isConnected,
  }))
  const waitingCount = data.waitingForUsCount ?? waitingRows.length
  const waitingPage = data.waitingPage ?? 1
  const waitingPageSize = data.waitingPageSize ?? 50

  // Keep URL in sync when server clamps an out-of-range waitingPage.
  if (
    activeTab === 'waiting' &&
    requestedWaitingPage !== waitingPage
  ) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null && value !== '' && key !== 'waitingPage') params.set(key, value)
    }
    params.set('tab', 'waiting')
    if (waitingPage > 1) params.set('waitingPage', String(waitingPage))
    redirect(`/salesrobot?${params.toString()}`)
  }

  const rangeLabel =
    searchParams.preset === 'custom' && searchParams.from && searchParams.to
      ? `${searchParams.from} → ${searchParams.to}`
      : range.preset.replace(/_/g, ' ')

  const hasActivity =
    data.kpis.connectionRequestsSent > 0 ||
    data.kpis.connectionsAccepted > 0 ||
    data.kpis.messagesSent > 0 ||
    data.kpis.repliesReceived > 0 ||
    data.weekRows.length > 0 ||
    data.campaignComparison.length > 0

  const kpis = [
    {
      label: 'Prospects',
      value: data.kpis.prospectsAdded.toLocaleString(),
      hint: 'In selected campaigns',
      accent: 'bg-slate-400',
    },
    {
      label: 'Requests sent',
      value: data.kpis.connectionRequestsSent.toLocaleString(),
      hint: 'Connection invites',
      accent: 'bg-blue-500',
    },
    {
      label: 'Connections',
      value: data.kpis.connectionsAccepted.toLocaleString(),
      hint: 'Accepted invites',
      accent: 'bg-emerald-500',
    },
    {
      label: 'Messages sent',
      value: data.kpis.messagesSent.toLocaleString(),
      hint: 'Outreach messages',
      accent: 'bg-sky-500',
    },
    {
      label: 'Replies',
      value: data.kpis.repliesReceived.toLocaleString(),
      hint: 'Inbound replies',
      accent: 'bg-amber-500',
    },
    {
      label: 'Acceptance',
      value: formatRatePercent(
        data.kpis.acceptanceRate,
        data.kpis.connectionRequestsSent
      ),
      hint: 'Accepted ÷ requests',
      accent: 'bg-teal-600',
    },
    {
      label: 'Reply rate',
      value: formatRatePercent(
        data.kpis.replyRate,
        data.kpis.messagesSent || data.kpis.connectionsAccepted
      ),
      hint: 'Replies ÷ messages',
      accent: 'bg-orange-500',
    },
    {
      label: 'Waiting for us',
      value: String(waitingCount),
      hint: 'Replied, need follow-up',
      accent: 'bg-rose-500',
    },
  ]

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              SalesRobot Analytics
            </h1>
            {configured && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">
                Connected
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 max-w-xl">
            LinkedIn outreach performance pulled from SalesRobot — filter by week, campaign, or
            account.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {data.filterOptions.accounts.length} accounts
            </span>
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {data.filterOptions.campaigns.length} campaigns
            </span>
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 capitalize">
              {rangeLabel}
            </span>
          </div>
        </div>
        <SalesRobotSyncButton
          canSync={canSync}
          lastSyncedAt={data.lastSyncedAt ? fmtDateTime(data.lastSyncedAt) : null}
        />
      </div>

      {!configured && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set <code className="font-mono text-xs">SALESROBOT_API_KEY</code> in the environment, then
          run Sync. Webhook URL:{' '}
          <code className="font-mono text-xs">/api/integrations/salesrobot/webhook</code>
        </div>
      )}

      {configured && data.filterOptions.campaigns.length === 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          No campaigns synced yet. Click <strong>Sync now</strong> to pull data from SalesRobot.
        </div>
      )}

      {configured &&
        activeTab === 'analytics' &&
        data.filterOptions.campaigns.length > 0 &&
        !hasActivity && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            No activity for <strong>{rangeLabel}</strong> with the current filters. Try another date
            range, account, or campaign.
          </div>
        )}

      <WaitingCountProvider initialCount={waitingCount}>
        <Suspense fallback={<div className="mb-6 h-11 w-72 rounded-xl bg-gray-100 animate-pulse" />}>
          <SalesRobotTabs active={activeTab} />
        </Suspense>

        <SalesRobotClientShell
          filters={
            <Suspense
              fallback={
                <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 text-sm text-gray-400">
                  Loading filters…
                </div>
              }
            >
              <SalesRobotFilters
                campaigns={data.filterOptions.campaigns}
                accounts={data.filterOptions.accounts}
                statuses={data.filterOptions.statuses}
              />
            </Suspense>
          }
        >
          {activeTab === 'waiting' ? (
            <SalesRobotWaitingList
              canMarkDone={canSync}
              rows={waitingRows}
              page={waitingPage}
              pageSize={waitingPageSize}
            />
          ) : (
            <>
              <SalesRobotKpiGrid kpis={kpis} />

              <div className="mb-6">
                <SalesRobotCharts
                  trend={data.trend.map(t => ({
                    label: t.label,
                    connectionRequestsSent: t.connectionRequestsSent,
                    connectionsAccepted: t.connectionsAccepted,
                    repliesReceived: t.repliesReceived,
                    acceptanceRate: t.acceptanceRate,
                    replyRate: t.replyRate,
                  }))}
                />
              </div>

              <div className="space-y-4 mb-6">
                <SalesRobotCampaignTable
                  rows={data.campaignComparison.map(row => ({
                    campaignId: row.campaignId,
                    name: row.name,
                    connectionRequestsSent: row.connectionRequestsSent,
                    connectionsAccepted: row.connectionsAccepted,
                    messagesSent: row.messagesSent,
                    repliesReceived: row.repliesReceived,
                  }))}
                />
                <SalesRobotWeeklyTable
                  rows={data.weekRows.map(row => ({
                    id: row.id,
                    weekLabel: `${fmtDate(row.weekStart)} – ${fmtDate(row.weekEnd)}`,
                    campaignName: row.campaignName,
                    prospectsAdded: row.prospectsAdded,
                    connectionRequestsSent: row.connectionRequestsSent,
                    connectionsAccepted: row.connectionsAccepted,
                    messagesSent: row.messagesSent,
                    repliesReceived: row.repliesReceived,
                  }))}
                />
              </div>
            </>
          )}
        </SalesRobotClientShell>
      </WaitingCountProvider>
    </div>
  )
}
