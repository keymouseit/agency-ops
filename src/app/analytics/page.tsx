import { redirect } from 'next/navigation'

/**
 * Retired: Analytics now lives under Business (`/overview`).
 * Kept as a redirect so old links / bookmarks keep working.
 *   /analytics          → /overview?tab=sales
 *   /analytics?tab=bd   → /overview?tab=sales&view=bd (date range preserved)
 */
export default function AnalyticsRedirect({
  searchParams,
}: {
  searchParams: { tab?: string | string[]; fromDate?: string | string[]; toDate?: string | string[] }
}) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const params = new URLSearchParams({ tab: 'sales' })
  if (one(searchParams.tab) === 'bd') {
    params.set('view', 'bd')
    const from = one(searchParams.fromDate)
    const to = one(searchParams.toDate)
    if (from) params.set('fromDate', from)
    if (to) params.set('toDate', to)
  }
  redirect(`/overview?${params}`)
}
