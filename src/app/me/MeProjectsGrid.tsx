import Link from 'next/link'
import { differenceInDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { isSameWeek } from '@/lib/utils'
import { businessDayStart } from '@/lib/daily'
import { QASignOffBadge } from '@/components/QASignOffStatus'
import { calculateMilestoneProgress } from '@/lib/milestone-qa'
import { assignedToMemberWhere } from '@/lib/project-assignees'
import { milestoneListOrderBy } from '@/lib/project-queries'
import MeSection from './MeSection'

type Props = {
  memberId: string
  role: string
}

/** Full-width responsive project card grid for /me. */
export default async function MeProjectsGrid({ memberId, role }: Props) {
  const isDev = role === 'Dev' || role === 'Both'
  if (!isDev) return null

  const today = businessDayStart()
  const myProjects = await prisma.project.findMany({
    where: { AND: [assignedToMemberWhere(memberId), { status: { in: ['scoping', 'active', 'qa'] } }] },
    select: {
      id: true,
      name: true,
      status: true,
      milestones: {
        select: { status: true, title: true, dueDate: true },
        orderBy: milestoneListOrderBy,
      },
      checkIns: {
        where: { submittedById: memberId },
        orderBy: { weekOf: 'desc' },
        take: 1,
        select: { onTrack: true, blockers: true, weekOf: true },
      },
      releaseSignOff: { select: { id: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (myProjects.length === 0) return null

  const visible = myProjects.slice(0, 6)
  const moreCount = myProjects.length - visible.length

  return (
    <MeSection
      title="Your projects"
      icon="🚀"
      actionHref="/projects"
      actionLabel="All →"
      className="me-stagger-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map(p => {
          const ci = p.checkIns[0]
          const totalMilestones = p.milestones.length
          const calculatedProgress =
            totalMilestones > 0 ? calculateMilestoneProgress(p.milestones) : null
          const milestone = p.milestones.find(m => m.status !== 'done')
          const daysLeft = milestone?.dueDate
            ? differenceInDays(new Date(milestone.dueDate), today)
            : null
          const isLate = daysLeft !== null && daysLeft < 0
          const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
          const isMonday = today.getDay() === 1
          const projectCheckinThisWeek = ci ? isSameWeek(ci.weekOf, today) : false
          const projectCheckinOverdue = ci
            ? differenceInDays(today, new Date(ci.weekOf)) > 7
            : true
          const needsCheckin =
            !projectCheckinThisWeek && (isMonday || projectCheckinOverdue)
          const inQA = p.status === 'qa'
          const signedOff = !!p.releaseSignOff
          const atRisk = ci?.onTrack === 'no'
          const monitor = ci?.onTrack === 'at_risk'

          return (
            <div
              key={p.id}
              className={`me-card-lift rounded-lg border p-3.5 h-full flex flex-col shadow-[var(--me-shadow)] ${
                atRisk
                  ? 'border-red-200 bg-red-50/30'
                  : monitor
                    ? 'border-amber-200 bg-amber-50/30'
                    : inQA
                      ? 'border-sky-200 bg-sky-50/30'
                      : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-sm font-semibold text-gray-900 hover:underline tracking-tight"
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${
                        p.status === 'qa'
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : p.status === 'active'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {p.status}
                    </span>
                    {signedOff && <QASignOffBadge signed />}
                    {atRisk && (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 border border-red-200">
                        At risk
                      </span>
                    )}
                    {monitor && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                        Monitor
                      </span>
                    )}
                  </div>
                </div>
                {needsCheckin && (
                  <Link
                    href="/checkin"
                    className="me-btn-premium text-[11px] px-2 py-1 bg-amber-50 text-amber-900 rounded-md font-medium border border-amber-200 hover:bg-amber-100 shrink-0"
                  >
                    Check-in due
                  </Link>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-1.5 text-xs text-gray-500">
                {calculatedProgress !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[7rem]">
                      <div
                        className={`me-progress-fill h-full rounded-full ${
                          calculatedProgress >= 80
                            ? 'bg-emerald-500'
                            : calculatedProgress >= 50
                              ? 'bg-amber-400'
                              : calculatedProgress >= 25
                                ? 'bg-sky-500'
                                : 'bg-gray-400'
                        }`}
                        style={{ width: `${calculatedProgress}%` }}
                      />
                    </div>
                    <span className="tabular-nums font-medium text-gray-600">{calculatedProgress}%</span>
                  </div>
                )}
                {milestone && (
                  <p
                    className={
                      isLate
                        ? 'text-red-700 font-medium'
                        : isUrgent
                          ? 'text-amber-800 font-medium'
                          : 'text-gray-500'
                    }
                  >
                    {isLate
                      ? `"${milestone.title}" overdue by ${Math.abs(daysLeft!)}d`
                      : daysLeft === 0
                        ? `"${milestone.title}" due today`
                        : `"${milestone.title}" in ${daysLeft}d`}
                  </p>
                )}
                {ci?.blockers && (
                  <p className="text-amber-800 line-clamp-1">Blocker: {ci.blockers}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {moreCount > 0 && (
        <Link
          href="/projects"
          className="me-btn-premium mt-3 flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-800"
        >
          +{moreCount} more project{moreCount === 1 ? '' : 's'}
        </Link>
      )}
    </MeSection>
  )
}
