import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isFollowUpPending } from '@/lib/mom'
import { getMomFinalStatusMap } from '@/lib/mom-form'
import Link from 'next/link'
import MomAnalytics from './MomAnalytics'
import MomExportButton from './MomExportButton'
import MomListPanel from './MomListPanel'
import { differenceInDays, isSameMonth, startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function MomPage() {
  const session = await auth()
  const isFounder = session?.user?.role === 'Founder'

  const records = await prisma.meetingMinute.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ meetingDate: 'desc' }, { createdAt: 'desc' }],
  })

  const listRecords = records
    .filter(r => !r.parentId)
    .map(r => ({
      ...r,
      followUpCount: records.filter(c => c.parentId === r.id).length,
    }))

  const statusMap = await getMomFinalStatusMap(listRecords.map(r => r.id))
  const listWithStatus = listRecords.map(r => ({
    ...r,
    finalStatus: statusMap[r.id] || r.finalStatus || 'Active',
  }))

  const today = startOfDay(new Date())
  const thisMonth = records.filter(r => isSameMonth(r.meetingDate, today)).length
  const followUpsOverdue = records.filter(r => isFollowUpPending(r) &&
    differenceInDays(startOfDay(r.followUpDate!), today) < 0
  ).length
  const followUpsUpcoming = records.filter(r => {
    if (!isFollowUpPending(r)) return false
    const d = differenceInDays(startOfDay(r.followUpDate!), today)
    return d >= 0 && d <= 7
  }).length

  const statusCounts = { Active: 0, Hold: 0, Closed: 0 }
  for (const r of listWithStatus) {
    const status = r.finalStatus === 'Hold' || r.finalStatus === 'Closed' ? r.finalStatus : 'Active'
    statusCounts[status] += 1
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

      <div className="grid grid-cols-6 gap-3 mb-6">
        <div className="card p-3">
          <div className="text-2xl font-bold text-gray-900">{records.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total meetings</div>
          <div className="text-xs text-gray-400 mt-1">{thisMonth} this month</div>
        </div>
        <div className="card p-3 border-emerald-200 bg-emerald-50/40">
          <div className="text-2xl font-bold text-emerald-800">{statusCounts.Active}</div>
          <div className="text-xs text-emerald-800/70 mt-0.5">Active</div>
        </div>
        <div className="card p-3 border-amber-200 bg-amber-50/40">
          <div className="text-2xl font-bold text-amber-800">{statusCounts.Hold}</div>
          <div className="text-xs text-amber-800/70 mt-0.5">Hold</div>
        </div>
        <div className="card p-3 border-slate-200 bg-slate-50">
          <div className="text-2xl font-bold text-slate-700">{statusCounts.Closed}</div>
          <div className="text-xs text-slate-500 mt-0.5">Closed</div>
        </div>
        <div className={`card p-3 ${followUpsOverdue > 0 ? 'border-red-200 bg-red-50/40' : ''}`}>
          <div className={`text-2xl font-bold ${followUpsOverdue > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {followUpsOverdue}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Overdue follow-ups</div>
        </div>
        <div className={`card p-3 ${followUpsUpcoming > 0 ? 'border-blue-200 bg-blue-50/40' : ''}`}>
          <div className={`text-2xl font-bold ${followUpsUpcoming > 0 ? 'text-blue-700' : 'text-gray-900'}`}>
            {followUpsUpcoming}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Due in next 7 days</div>
        </div>
      </div>

      {isFounder && records.length > 0 && <MomAnalytics records={records} />}

      <MomListPanel records={listWithStatus} />
    </div>
  )
}
