import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { getAnalyticsDashboard, resolveDateRange } from '@/lib/salesrobot'

export const dynamic = 'force-dynamic'

const ROLES = ['Founder', 'Manager', 'BD', 'Both'] as const

export async function GET(request: Request) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange({
    preset: searchParams.get('preset'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  })

  const data = await getAnalyticsDashboard({
    from: range.from,
    to: range.to,
    campaignId: searchParams.get('campaignId'),
    linkedinAccountId: searchParams.get('accountId'),
    status: searchParams.get('status'),
  })

  return NextResponse.json({ ...data, range })
}
