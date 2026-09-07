import { prisma } from '@/lib/prisma'
import QATestingActivityList from '@/components/QATestingActivityList'
import { auth } from '@/lib/auth'
import { canViewQATestCycles } from '@/lib/qa-access'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function QATestingActivityPage() {
  const session = await auth()
  if (!canViewQATestCycles(session?.user?.role)) redirect('/')
  const recentQAActivity = await prisma.auditLog.findMany({
    where: {
      entityType: 'Project',
      metadata: { contains: 'qaEventType' },
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-teal-50/30 px-4 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-lg text-white shrink-0">
              🔍
            </span>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Testing activity</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Test cycles, milestone reviews, re-tests, and release sign-offs across all projects.
              </p>
            </div>
          </div>
          <Link href="/qa" className="btn-secondary text-sm shrink-0 self-start">
            ← QA dashboard
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{recentQAActivity.length}</span>
          {recentQAActivity.length === 50 ? '+' : ''} recent events
        </p>
      </div>

      <QATestingActivityList logs={recentQAActivity} />
    </div>
  )
}
