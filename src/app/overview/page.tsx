import { Suspense } from 'react'
import Link from 'next/link'
import { formatIstWeekdayLong } from '@/lib/ist'
import { DashboardKpiFallback } from '@/components/SectionFallbacks'
import ReportTabs from '@/components/ReportTabs'
import { KpiIcon } from '@/components/KpiCard'
import SummaryTab from './SummaryTab'
import type { HealthFilter } from './ProjectHealthList'
import SalesTab from './SalesTab'
import DeliveryTab from './DeliveryTab'
import BdActivitySection from './BdActivitySection'

export const dynamic = 'force-dynamic'

type Tab = 'summary' | 'sales' | 'delivery'
type SearchParams = { tab?: string; view?: string; fromDate?: string; toDate?: string; health?: string }

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

/**
 * Business (Founder / Manager) — replaces the old Business overview, Analytics
 * and Founder Intelligence pages. Tabs are server-rendered from `?tab=` so
 * each one is linkable; /analytics and /intelligence redirect here.
 */
export default function BusinessPage({ searchParams }: { searchParams: SearchParams }) {
  const rawTab = one(searchParams.tab)
  const tab: Tab = rawTab === 'sales' || rawTab === 'delivery' ? rawTab : 'summary'
  const salesView = one(searchParams.view) === 'bd' ? 'bd' : 'results'
  const fromDate = one(searchParams.fromDate)
  const toDate = one(searchParams.toDate)
  const rawHealth = one(searchParams.health)
  const healthFilter: HealthFilter =
    rawHealth === 'at-risk' || rawHealth === 'attention' || rawHealth === 'healthy' ? rawHealth : 'all'

  return (
    <div>
      <div className="mb-5 sm:mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight">Business</h1>
          <p className="text-sm text-gray-500 mt-1 sm:mt-0.5 leading-snug">
            Pipeline, delivery, and project health. For what needs your decision today, see{' '}
            <Link href="/" className="text-gray-900 underline underline-offset-2 hover:text-gray-600">
              Needs you
            </Link>
            .
          </p>
        </div>
        <p className="text-xs text-gray-400 tabular-nums sm:text-right shrink-0 pt-0.5">
          {formatIstWeekdayLong(new Date())}
        </p>
      </div>

      <ReportTabs
        active={tab}
        tabs={[
          { key: 'summary', label: 'Summary', href: '/overview' },
          { key: 'sales', label: 'Sales', href: '/overview?tab=sales' },
          { key: 'delivery', label: 'Delivery', href: '/overview?tab=delivery' },
        ]}
      />

      {tab === 'sales' && (
        <ReportTabs
          variant="pills"
          active={salesView}
          tabs={[
            {
              key: 'results',
              label: 'Results',
              href: '/overview?tab=sales',
              icon: <KpiIcon name="chart" className="h-3.5 w-3.5" />,
            },
            {
              key: 'bd',
              label: 'BD activity',
              href: '/overview?tab=sales&view=bd',
              icon: <KpiIcon name="touches" className="h-3.5 w-3.5" />,
            },
          ]}
        />
      )}

      <Suspense
        key={`${tab}:${salesView}:${fromDate ?? ''}:${toDate ?? ''}`}
        fallback={<DashboardKpiFallback />}
      >
        {tab === 'summary' ? (
          <SummaryTab healthFilter={healthFilter} />
        ) : tab === 'delivery' ? (
          <DeliveryTab />
        ) : salesView === 'bd' ? (
          <BdActivitySection fromDate={fromDate} toDate={toDate} />
        ) : (
          <SalesTab />
        )}
      </Suspense>
    </div>
  )
}
