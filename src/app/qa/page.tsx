import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { canViewQATestCycles } from '@/lib/qa-access'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import QAProjectListCard from './QAProjectListCard'

export const dynamic = 'force-dynamic'

export default async function QAPage() {
  const session = await auth()
  if (!canViewQATestCycles(session?.user?.role)) redirect('/')
  const [projects, recentIssues] = await Promise.all([
    prisma.project.findMany({
      where: { status: { in: ['active', 'qa', 'scoping'] } },
      include: {
        developer: true,
        bdMember: true,
        milestones: {
          orderBy: { dueDate: 'asc' },
          include: {
            testCases: { select: { status: true } },
          },
        },
        testCycles: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            conductedBy: true,
            signOff: true,
            cases: { select: { status: true, devFixedAt: true } },
          },
        },
        releaseSignOff: { include: { signedOffBy: true } },
        postDeliveryIssues: { orderBy: { reportedAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.postDeliveryIssue.findMany({
      where: { resolvedAt: null },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { reportedAt: 'asc' },
      take: 10,
    }),
  ])

  const allIssues = await prisma.postDeliveryIssue.findMany({
    select: { id: true, severity: true, wasInScope: true },
  })

  const qaProjects = projects.filter(p => p.status === 'qa')
  const failedProjects = projects.filter(p => p.testCycles[0]?.result === 'fail')
  const blockedProjects = projects.filter(p => p.testCycles[0]?.result === 'blocked')
  const readyToSign = projects.filter(p => p.testCycles[0]?.result === 'pass' && !p.releaseSignOff)
  const issuesMissed = allIssues.filter(i => i.wasInScope === true).length

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-violet-50/30 px-4 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">QA — Release gate</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Test cycles · Milestone testing · Release sign-off · Post-delivery issues.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'In QA stage', value: qaProjects.length, sub: 'Awaiting sign-off', danger: false },
          {
            label: 'Failed',
            value: failedProjects.length,
            sub: 'Defects found in test cycle',
            danger: failedProjects.length > 0,
          },
          {
            label: 'Blocked',
            value: blockedProjects.length,
            sub: 'Cannot test or release yet',
            danger: blockedProjects.length > 0,
          },
          { label: 'Ready for sign-off', value: readyToSign.length, sub: 'Test passed, needs sign-off', danger: false },
          {
            label: 'Client issues (QA miss)',
            value: issuesMissed,
            sub: 'Reported after delivery',
            danger: issuesMissed > 0,
          },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.danger ? 'text-red-600' : 'text-gray-900'}`}>
              {k.value}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Link href="/qa/activity" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          View testing activity →
        </Link>
      </div>

      {recentIssues.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-800 mb-3">
            {recentIssues.length} unresolved post-delivery issue{recentIssues.length > 1 ? 's' : ''} — client
            reported these after release
          </div>
          <div className="space-y-2">
            {recentIssues.map(issue => (
              <div key={issue.id} className="flex items-start justify-between text-sm gap-3">
                <div className="min-w-0">
                  <span
                    className={`badge mr-2 text-xs ${issue.severity === 'critical' ? 'bg-red-100 text-red-800' : issue.severity === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {issue.severity}
                  </span>
                  <span className="text-red-700 font-medium">{issue.project.name}</span>
                  <span className="text-red-600 ml-2">
                    — {issue.description.slice(0, 80)}
                    {issue.description.length > 80 ? '…' : ''}
                  </span>
                </div>
                <Link
                  href={`/qa/${issue.project.id}`}
                  className="text-xs text-red-600 hover:text-red-800 shrink-0 font-medium"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Active projects</h2>
          <span className="badge bg-gray-100 text-gray-600 text-[11px]">{projects.length}</span>
        </div>
        <div className="space-y-3">
          {projects.map(p => (
            <QAProjectListCard key={p.id} project={p} />
          ))}
          {projects.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-xl">
                🔍
              </div>
              <p className="text-sm font-medium text-gray-700">No active projects in QA</p>
              <p className="text-xs text-gray-400 mt-1">
                Projects appear here when their status is active, qa, or scoping.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
