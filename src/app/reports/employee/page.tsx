import { redirect } from 'next/navigation'

/**
 * Retired: the Employee report lives on `/reports/team`.
 * Preserves query params (memberId, range, from, to).
 */
export default function EmployeeReportRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'tab' || value == null) continue
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v)
  }
  const qs = params.toString()
  redirect(qs ? `/reports/team?${qs}` : '/reports/team')
}
