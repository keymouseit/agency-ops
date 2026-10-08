import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { leaveTypeLabel } from '@/lib/leave-today'
import { formatIstDateTimeShort, istYearAndMonth } from '@/lib/ist'
import {
  fmtDate,
  isMomActionOpenish,
  MOM_ACTION_STATUS_COLORS,
  momActionStatusLabel,
  PROJECT_STATUS_LABELS,
  ROLE_COLORS,
} from '@/lib/utils'
import EmployeeProjectsTabs from './EmployeeProjectsTabs'

export const dynamic = 'force-dynamic'

function roleLabel(role: string) {
  return role === 'SocialMedia' ? 'Social Media' : role
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const AVATAR_BG: Record<string, string> = {
  Founder: 'bg-purple-600',
  Manager: 'bg-indigo-600',
  BD: 'bg-blue-600',
  Dev: 'bg-emerald-600',
  QA: 'bg-teal-600',
  HR: 'bg-rose-600',
  SocialMedia: 'bg-pink-600',
  Both: 'bg-amber-600',
}

const LEAVE_STATUS_CLS: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-800',
  pending: 'bg-amber-50 text-amber-800',
  rejected: 'bg-red-50 text-red-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

const BLOCKER_STATUS_CLS: Record<string, string> = {
  open: 'bg-red-50 text-red-800',
  in_progress: 'bg-amber-50 text-amber-800',
  escalated: 'bg-rose-50 text-rose-800',
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  const userRole = session?.user?.role
  if (!userRole || !['Founder', 'Manager', 'HR'].includes(userRole)) {
    redirect('/')
  }

  const { year: currentYear } = istYearAndMonth()

  const member = await prisma.teamMember.findUnique({
    where: { id: params.id },
    include: {
      userAccount: { select: { id: true, createdAt: true, lastLoginAt: true } },
      leaveBalances: {
        where: { year: currentYear },
        take: 1,
      },
      leaves: {
        orderBy: { appliedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          leaveType: true,
          timeSlot: true,
          startDate: true,
          endDate: true,
          status: true,
          unpaid: true,
          reason: true,
        },
      },
      blockers: {
        where: { status: { in: ['open', 'in_progress', 'escalated'] } },
        orderBy: { raisedAt: 'desc' },
        take: 10,
        include: {
          project: { select: { id: true, name: true } },
        },
      },
      momActionItems: {
        where: { status: { in: ['Open', 'InProgress', 'Blocked'] } },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: {
          mom: { select: { id: true, meetingDate: true } },
        },
      },
      projectsAsDeveloper: {
        select: { id: true, name: true, status: true, clientName: true, actualEnd: true, estimatedEnd: true },
        orderBy: { name: 'asc' },
      },
      projectsAsBD: {
        select: { id: true, name: true, status: true, clientName: true, actualEnd: true, estimatedEnd: true },
        orderBy: { name: 'asc' },
      },
      projectAssignments: {
        include: {
          project: {
            select: { id: true, name: true, status: true, clientName: true, actualEnd: true, estimatedEnd: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!member) notFound()

  type LinkedProject = {
    id: string
    name: string
    status: string
    clientName: string | null
    actualEnd: Date | null
    estimatedEnd: Date | null
  }

  const projectById = new Map<string, LinkedProject>()
  const rolesByProject = new Map<string, string[]>()

  function addProject(p: LinkedProject, role: string) {
    projectById.set(p.id, p)
    const roles = rolesByProject.get(p.id) ?? []
    if (!roles.includes(role)) roles.push(role)
    rolesByProject.set(p.id, roles)
  }

  for (const p of member.projectsAsDeveloper) addProject(p, 'Developer')
  for (const p of member.projectsAsBD) addProject(p, 'BD')
  for (const a of member.projectAssignments) addProject(a.project, 'Assignee')

  const projects = [...projectById.values()].sort((a, b) => a.name.localeCompare(b.name))
  const projectRows = projects.map(p => ({
    id: p.id,
    name: p.name,
    status: p.status,
    clientName: p.clientName,
    actualEnd: p.actualEnd ? p.actualEnd.toISOString() : null,
    estimatedEnd: p.estimatedEnd ? p.estimatedEnd.toISOString() : null,
    roles: rolesByProject.get(p.id) ?? ['Assignee'],
  }))
  const canManage = ['Founder', 'Manager'].includes(userRole)

  const statusCounts = projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})
  const statusSummary = (['active', 'scoping', 'delivered', 'qa', 'on_hold', 'maintenance'] as const)
    .filter(s => statusCounts[s])
    .map(s => `${PROJECT_STATUS_LABELS[s] ?? s} ${statusCounts[s]}`)
    .join(' · ')

  const birthday = member.birthday
  const hasLogin = !!member.userAccount
  const lastLoginAt = member.userAccount?.lastLoginAt ?? null
  const balance = member.leaveBalances[0] ?? null
  const openBlockers = member.blockers
  const openMom = member.momActionItems.filter(a => isMomActionOpenish(a.status))
  const recentLeaves = member.leaves
  const shortLeaveYear = balance?.shortLeaves ?? null
  const leaveUsed = balance?.used ?? null
  const leaveAccrued = balance?.accrued ?? null
  const leaveRemaining =
    leaveAccrued != null && leaveUsed != null
      ? Math.max(0, leaveAccrued - leaveUsed)
      : null

  const individualReportHref = `/reports/team?memberId=${encodeURIComponent(member.id)}`
  const now = Date.now()

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/settings" className="text-xs text-gray-400 hover:text-gray-700">
          ← Team Members
        </Link>
      </div>

      {/* Hero */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <span
              className={`flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl text-lg sm:text-xl font-bold text-white shadow-sm ${
                AVATAR_BG[member.role] ?? 'bg-slate-800'
              }`}
              aria-hidden
            >
              {initials(member.name)}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight truncate">
                  {member.name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    ROLE_COLORS[member.role] ?? 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {roleLabel(member.role)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    member.active
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/15'
                      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-500/10'
                  }`}
                >
                  {member.active ? 'Active' : 'Inactive'}
                </span>
                {member.attendanceExcluded && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600">
                    Attendance excluded
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{member.email}</p>
              {hasLogin && lastLoginAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Last login {formatIstDateTimeShort(lastLoginAt)}
                </p>
              )}
              {hasLogin && !lastLoginAt && (
                <p className="text-xs text-gray-400 mt-1">Never logged in</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
            <Link
              href={individualReportHref}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100"
            >
              Individual report
              <span aria-hidden>→</span>
            </Link>
            {canManage && (
              <Link
                href="/settings"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-600 shadow-sm hover:bg-slate-50 hover:border-gray-300"
              >
                Edit in Settings
                <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Meta KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Joining date
          </p>
          <p className="mt-2 text-xl font-bold text-gray-900 tabular-nums tracking-tight">
            {fmtDate(member.createdAt)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Account created</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Birthday
          </p>
          {birthday ? (
            <>
              <p className="mt-2 text-xl font-bold text-gray-900 tabular-nums tracking-tight">
                {fmtDate(birthday)}
              </p>
              <p className="mt-1 text-xs text-gray-400">On file</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-gray-300 tracking-tight">Not set</p>
              <p className="mt-1 text-xs text-gray-400">Add via Edit in Settings</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Account
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                hasLogin ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
              aria-hidden
            />
            <p className="text-base font-bold text-gray-900">
              {hasLogin ? 'Login enabled' : 'No login'}
            </p>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {hasLogin
              ? lastLoginAt
                ? `Last ${formatIstDateTimeShort(lastLoginAt)}`
                : 'Never logged in'
              : 'Invite not created'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Projects
          </p>
          <p className="mt-2 text-xl font-bold text-gray-900 tabular-nums tracking-tight">
            {projects.length}
          </p>
          <p className="mt-1 text-xs text-gray-400 truncate">
            {statusSummary || 'Assigned / linked'}
          </p>
        </div>
      </div>

      {/* Leave + attention row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Leave snapshot */}
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Leave snapshot</h2>
              <p className="text-xs text-gray-500 mt-0.5">{currentYear} balance · recent requests</p>
            </div>
            <Link
              href="/leaves"
              className="text-[11px] font-semibold text-blue-600 hover:underline shrink-0"
            >
              Leaves →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
            <div className="bg-white px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Remaining
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {leaveRemaining != null ? leaveRemaining : '—'}
              </p>
              <p className="text-[10px] text-gray-400">
                {leaveAccrued != null ? `${leaveUsed ?? 0} used of ${leaveAccrued}` : 'No balance row'}
              </p>
            </div>
            <div className="bg-white px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Short leaves
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {shortLeaveYear != null ? shortLeaveYear : '—'}
              </p>
              <p className="text-[10px] text-gray-400">
                {shortLeaveYear != null ? `${currentYear} approved` : 'No balance row'}
              </p>
            </div>
            <div className="bg-white px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Comp off
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {balance
                  ? Math.max(0, (balance.compOffAccrued ?? 0) - (balance.compOffUsed ?? 0))
                  : '—'}
              </p>
              <p className="text-[10px] text-gray-400">
                {balance
                  ? `${balance.compOffUsed ?? 0} used of ${balance.compOffAccrued ?? 0}`
                  : '—'}
              </p>
            </div>
          </div>

          {recentLeaves.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">No leave requests yet</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentLeaves.map(l => (
                <li
                  key={l.id}
                  className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {leaveTypeLabel(l.leaveType, l.timeSlot)}
                      {l.unpaid ? (
                        <span className="ml-1.5 text-[10px] font-bold text-amber-700">Unpaid</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                      {fmtDate(l.startDate)}
                      {fmtDate(l.startDate) !== fmtDate(l.endDate)
                        ? ` → ${fmtDate(l.endDate)}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                      LEAVE_STATUS_CLS[l.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Open attention: blockers + MOM */}
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Needs attention</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Open blockers · open MOM actions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
            <div className="bg-white px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Open blockers
              </p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  openBlockers.length > 0 ? 'text-red-700' : 'text-gray-900'
                }`}
              >
                {openBlockers.length}
              </p>
            </div>
            <div className="bg-white px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                MOM open
              </p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  openMom.length > 0 ? 'text-amber-700' : 'text-gray-900'
                }`}
              >
                {openMom.length}
              </p>
            </div>
          </div>

          <div className="flex-1 divide-y divide-gray-100">
            <div>
              <p className="px-4 sm:px-5 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Blockers
              </p>
              {openBlockers.length === 0 ? (
                <p className="px-4 sm:px-5 pb-3 text-sm text-gray-400">None open</p>
              ) : (
                <ul className="pb-2">
                  {openBlockers.map(b => {
                    const ageDays = Math.max(
                      0,
                      Math.floor((now - new Date(b.raisedAt).getTime()) / (24 * 60 * 60 * 1000)),
                    )
                    return (
                      <li
                        key={b.id}
                        className="px-4 sm:px-5 py-2 flex flex-wrap items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 line-clamp-2">{b.description}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {b.project ? (
                              <Link
                                href={`/projects/${b.project.id}`}
                                className="hover:text-blue-600 font-medium text-gray-500"
                              >
                                {b.project.name}
                              </Link>
                            ) : (
                              'No project'
                            )}
                            {' · '}
                            {ageDays === 0 ? 'Today' : `${ageDays}d old`}
                            {b.escalatedToFounder ? ' · Escalated' : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                            BLOCKER_STATUS_CLS[b.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.status.replace(/_/g, ' ')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div>
              <p className="px-4 sm:px-5 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                MOM actions
              </p>
              {openMom.length === 0 ? (
                <p className="px-4 sm:px-5 pb-4 text-sm text-gray-400">None open</p>
              ) : (
                <ul className="pb-3">
                  {openMom.map(a => {
                    const overdue = new Date(a.dueDate).getTime() < now
                    return (
                      <li
                        key={a.id}
                        className="px-4 sm:px-5 py-2 flex flex-wrap items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/mom/${a.momId}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
                          >
                            {a.title}
                          </Link>
                          <p
                            className={`text-xs mt-0.5 tabular-nums ${
                              overdue ? 'text-red-600 font-semibold' : 'text-gray-400'
                            }`}
                          >
                            Due {fmtDate(a.dueDate)}
                            {overdue ? ' · Overdue' : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            MOM_ACTION_STATUS_COLORS[a.status] ??
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {momActionStatusLabel(a.status)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Projects — tabbed by lifecycle */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Projects</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              As developer, BD, or project assignee
            </p>
          </div>
          {projects.length > 0 && (
            <p className="text-[11px] font-semibold text-gray-400 tabular-nums">
              {projects.length} linked
            </p>
          )}
        </div>

        <EmployeeProjectsTabs projects={projectRows} />
      </section>
    </div>
  )
}
