import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ReportTabs from '@/components/ReportTabs'
import { CardSectionFallback } from '@/components/SectionFallbacks'
import EmployeeReportClient from '../employee/EmployeeReportClient'
import TeamTab from './TeamTab'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function IndividualTab({ searchParams }: { searchParams: SearchParams }) {
  const employees = await prisma.teamMember.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  const memberId = one(searchParams.memberId)
  const range = one(searchParams.range)
  const from = one(searchParams.from)
  const to = one(searchParams.to)
  const initialRange =
    range === 'week' || range === 'this_month' || range === 'custom' || range === 'month'
      ? range
      : 'month'
  const validCustom = initialRange === 'custom' && !!from && !!to && DATE_RE.test(from) && DATE_RE.test(to)

  return (
    <EmployeeReportClient
      key={memberId ?? 'default'}
      employees={employees}
      embedded
      initialMemberId={memberId && employees.some(e => e.id === memberId) ? memberId : undefined}
      initialRange={initialRange === 'custom' && !validCustom ? 'month' : initialRange}
      initialFrom={validCustom ? from : undefined}
      initialTo={validCustom ? to : undefined}
    />
  )
}

function TeamFallback() {
  return (
    <div aria-hidden>
      <CardSectionFallback className="mb-6" />
      <CardSectionFallback className="mb-0" />
    </div>
  )
}

/**
 * Team report (Founder / Manager): Team overview table + Individual
 * (the former Employee report). `/reports/employee` redirects here.
 */
export default async function TeamReportPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user?.id) return null
  const member = await prisma.teamMember.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!member) return null
  if (!['Founder', 'Manager'].includes(member.role)) redirect('/')

  const tab = one(searchParams.tab) === 'individual' ? 'individual' : 'team'

  return (
    <div>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight">Team</h1>
        <p className="text-sm text-gray-500 mt-1 sm:mt-0.5 leading-snug">
          Scores, goals, and utilisation for everyone — open a person for their full report.
        </p>
      </div>

      <ReportTabs
        active={tab}
        tabs={[
          { key: 'team', label: 'Team', href: '/reports/team' },
          { key: 'individual', label: 'Individual', href: '/reports/team?tab=individual' },
        ]}
      />

      <Suspense key={tab} fallback={<TeamFallback />}>
        {tab === 'individual' ? <IndividualTab searchParams={searchParams} /> : <TeamTab />}
      </Suspense>
    </div>
  )
}
