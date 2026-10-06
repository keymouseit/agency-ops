import { redirect } from 'next/navigation'

/**
 * Retired: the Employee report is now Team → Individual.
 * Redirects to `/reports/team?tab=individual`, preserving query params
 * (memberId, range, from, to).
 */
export default function EmployeeReportRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const params = new URLSearchParams({ tab: 'individual' })
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'tab' || value == null) continue
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v)
  }
  redirect(`/reports/team?${params}`)
}
