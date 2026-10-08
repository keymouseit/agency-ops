import { redirect } from 'next/navigation'

/**
 * Retired: Founder Intelligence was merged into Business (`/overview`) and
 * Team reports (`/reports/team`). Open blockers live on Needs you (`/`).
 * Kept as a redirect so old links and notifications keep working.
 */
export default function IntelligenceRedirect() {
  redirect('/overview')
}
