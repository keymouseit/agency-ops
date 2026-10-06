import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isFollowUpPending, threadPendingFollowUp } from '@/lib/mom'
import { getMomFinalStatusMap } from '@/lib/mom-form'
import { actionOverdueDays } from '@/lib/mom-actions'
import { isMomActionClosed, normalizeMomFinalStatus } from '@/lib/utils'
import Link from 'next/link'
import { Suspense } from 'react'
import MomAnalytics, {
  BdAttentionStrip,
  type AttentionItem,
  type AttentionStats,
  type BdAttentionStats,
} from './MomAnalytics'
import MomExportButton from './MomExportButton'
import MomListPanel from './MomListPanel'
import MomMyActions from './MomMyActions'
import { differenceInDays, startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function MomPage() {
  const session = await auth()
  const isFounder = session?.user?.role === 'Founder'
  const isManager = session?.user?.role === 'Manager'
  const showAttentionBoard = isFounder || isManager
  const currentMemberId = session?.user?.id ?? null

  const records = await prisma.meetingMinute.findMany({
    include: {
      createdBy: { select: { name: true } },
      actionItems: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          ownerId: true,
          blockedReason: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }],
      },
    },
    orderBy: [{ meetingDate: 'desc' }, { createdAt: 'desc' }],
  })

  const listRecords = records
    .filter(r => !r.parentId)
    .map(r => {
      const children = records.filter(c => c.parentId === r.id)
      const threadActionItems = [
        ...r.actionItems,
        ...children.flatMap(c => c.actionItems),
      ]
      // List rows show the thread's pending next-call (root or latest child).
      const pending = threadPendingFollowUp(r, children)
      return {
        ...r,
        followUpDate: pending?.followUpDate ?? null,
        followUpCompletedAt: null,
        followUpCount: children.length,
        threadActionItems,
      }
    })

  const statusMap = await getMomFinalStatusMap(listRecords.map(r => r.id))
  const listWithStatus = listRecords.map(r => ({
    ...r,
    finalStatus: normalizeMomFinalStatus(statusMap[r.id] || r.finalStatus),
  }))

  const today = startOfDay(new Date())
  const followUpsOverdue = records.filter(r => isFollowUpPending(r) &&
    differenceInDays(startOfDay(r.followUpDate!), today) < 0
  ).length
  const followUpsUpcoming = records.filter(r => {
    if (!isFollowUpPending(r)) return false
    const d = differenceInDays(startOfDay(r.followUpDate!), today)
    return d >= 0 && d <= 7
  }).length

  const allActions = records.flatMap(r =>
    r.actionItems.map(a => ({
      ...a,
      mom: {
        id: r.id,
        parentId: r.parentId,
        clientName: r.clientName,
        companyName: r.companyName,
      },
    }))
  )

  const myActions = currentMemberId
    ? allActions
        .filter(a => a.ownerId === currentMemberId && !isMomActionClosed(a.status))
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    : []

  const openActions = allActions.filter(a => !isMomActionClosed(a.status))
  const openOverdue = openActions.filter(a => actionOverdueDays(a, today) > 0)
  const blockedActionsList = openActions.filter(a => a.status === 'Blocked')

  const ownerIds = [...new Set([
    ...openOverdue.map(a => a.ownerId),
    ...blockedActionsList.map(a => a.ownerId),
  ])]
  const owners = ownerIds.length
    ? await prisma.teamMember.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true },
      })
    : []
  const ownerName = Object.fromEntries(owners.map(o => [o.id, o.name]))

  const actionsDueToday = openActions.filter(a => {
    const d = differenceInDays(startOfDay(a.dueDate), today)
    return d === 0
  }).length
  const actionsDueNext7 = openActions.filter(a => {
    const d = differenceInDays(startOfDay(a.dueDate), today)
    return d > 0 && d <= 7
  }).length
  const followUpsDueToday = records.filter(r =>
    isFollowUpPending(r) && differenceInDays(startOfDay(r.followUpDate!), today) === 0
  ).length
  const followUpsDueNext7 = records.filter(r => {
    if (!isFollowUpPending(r)) return false
    const d = differenceInDays(startOfDay(r.followUpDate!), today)
    return d > 0 && d <= 7
  }).length

  const topOverdue: AttentionItem[] = [
    ...openOverdue.map(a => {
      const rootId = a.mom.parentId ?? a.mom.id
      const clientLabel = a.mom.companyName
        ? `${a.mom.clientName} · ${a.mom.companyName}`
        : a.mom.clientName
      return {
        id: a.id,
        kind: 'action' as const,
        title: a.title,
        clientLabel,
        ownerName: ownerName[a.ownerId] ?? 'Unknown',
        daysOverdue: actionOverdueDays(a, today),
        href: `/mom/${rootId}`,
      }
    }),
    ...records
      .filter(r => isFollowUpPending(r) && differenceInDays(startOfDay(r.followUpDate!), today) < 0)
      .map(r => {
        const rootId = r.parentId ?? r.id
        const clientLabel = r.companyName
          ? `${r.clientName} · ${r.companyName}`
          : r.clientName
        const days = Math.abs(differenceInDays(startOfDay(r.followUpDate!), today))
        return {
          id: r.id,
          kind: 'follow_up' as const,
          title: `Follow-up with ${r.clientName}`,
          clientLabel,
          ownerName: r.createdBy.name,
          daysOverdue: days,
          href: `/mom/${rootId}`,
        }
      }),
  ]
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 5)

  const topBlocked = blockedActionsList
    .map(a => {
      const rootId = a.mom.parentId ?? a.mom.id
      const clientLabel = a.mom.companyName
        ? `${a.mom.clientName} · ${a.mom.companyName}`
        : a.mom.clientName
      return {
        id: a.id,
        title: a.title,
        clientLabel,
        ownerName: ownerName[a.ownerId] ?? 'Unknown',
        reason: (a.blockedReason ?? '').trim() || 'No reason given',
        href: `/mom/${rootId}`,
      }
    })
    .slice(0, 5)

  const attentionStats: AttentionStats = {
    overdueFollowUps: followUpsOverdue,
    overdueActions: openOverdue.length,
    dueToday: actionsDueToday + followUpsDueToday,
    dueNext7Days: actionsDueNext7 + followUpsDueNext7,
    openActions: openActions.length,
    blockedActions: blockedActionsList.length,
    topOverdue,
    topBlocked,
  }

  // Match list "due soon" filter: open/pending items with 0..7 days remaining
  const bdDueNext7Days =
    actionsDueToday + actionsDueNext7 + followUpsUpcoming
  const myBlockedActions = currentMemberId
    ? blockedActionsList.filter(a => a.ownerId === currentMemberId).length
    : 0
  const bdAttentionStats: BdAttentionStats = {
    overdueFollowUps: followUpsOverdue,
    overdueActions: openOverdue.length,
    dueNext7Days: bdDueNext7Days,
    myOpenActions: myActions.length,
    myBlockedActions,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Minutes of Meeting</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track discovery calls, demos, and client conversations with full context.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFounder && records.length > 0 && <MomExportButton />}
          <Link href="/mom/new" className="btn-primary">
            + Add New MOM
          </Link>
        </div>
      </div>

      {showAttentionBoard ? (
        <MomAnalytics stats={attentionStats} />
      ) : (
        <BdAttentionStrip stats={bdAttentionStats} />
      )}

      <MomMyActions actions={myActions} />

      <Suspense fallback={<div className="rounded-2xl border border-gray-100 bg-white h-40 animate-pulse" />}>
        <MomListPanel
          records={listWithStatus}
          currentMemberId={currentMemberId}
          hideImmediateBanner={showAttentionBoard}
        />
      </Suspense>
    </div>
  )
}
