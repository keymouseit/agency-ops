import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fmtDate, fmtCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-800',
  submitted:   'bg-amber-100 text-amber-800',
  revision:    'bg-red-100 text-red-700',
  confirmed:   'bg-purple-100 text-purple-800',
  approved:    'bg-green-100 text-green-800',
  sent:        'bg-teal-100 text-teal-800',
  won:         'bg-green-100 text-green-800',
  lost:        'bg-red-100 text-red-800',
}

const STATUS_ORDER = ['revision', 'pending', 'in_progress', 'confirmed', 'submitted', 'approved', 'sent', 'won', 'lost']

export default async function EstimatesPage() {
  const requests = await prisma.estimationRequest.findMany({
    include: {
      lead:     { select: { id: true, clientName: true, budget: true, currency: true, status: true } },
      assignee: { select: { id: true, name: true } },
      requester:{ select: { id: true, name: true } },
      record: {
        select: {
          id: true,
          totalHoursRaw: true,
          totalHoursFinal: true,
          bufferPct: true,
          totalPriceFinal: true,
          currency: true,
          overallRisk: true,
          devConfirmedAt: true,
          bdApprovedAt: true,
          bdRevisionNote: true,
          lines: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Sort so action-needed (revision, pending) appear first
  const sorted = [...requests].sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  )

  const pendingCount    = requests.filter(r => r.status === 'pending').length
  const revisionCount   = requests.filter(r => r.status === 'revision').length
  const approvedCount   = requests.filter(r => r.status === 'approved').length
  const confirmedCount  = requests.filter(r => r.status === 'confirmed').length

  const RISK_COLORS: Record<string, string> = {
    low: 'text-green-700', medium: 'text-amber-700', high: 'text-red-600',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Estimates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All estimation requests. BD requests → Dev fills → BD approves → proposal sent.
          </p>
        </div>
        <Link href="/pipeline" className="btn-secondary text-sm">
          Request from lead →
        </Link>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Needs revision',   value: revisionCount,  danger: true },
          { label: 'Awaiting dev',     value: pendingCount,   danger: pendingCount > 0 },
          { label: 'Dev confirmed',    value: confirmedCount, danger: false },
          { label: 'BD approved',      value: approvedCount,  danger: false },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.danger && k.value > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-3 py-3 font-medium">Assigned to</th>
              <th className="text-left px-3 py-3 font-medium">Requested by</th>
              <th className="text-center px-3 py-3 font-medium">Status</th>
              <th className="text-center px-3 py-3 font-medium">Hours</th>
              <th className="text-center px-3 py-3 font-medium">Quote</th>
              <th className="text-center px-3 py-3 font-medium">Risk</th>
              <th className="text-center px-3 py-3 font-medium">Lines</th>
              <th className="text-center px-3 py-3 font-medium">Requested</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(r => {
              const overBudget = r.record?.totalPriceFinal && r.lead.budget &&
                r.record.totalPriceFinal > r.lead.budget

              return (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'revision' ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.lead.clientName}</div>
                    {r.lead.budget && (
                      <div className={`text-xs mt-0.5 ${overBudget ? 'text-red-500' : 'text-gray-400'}`}>
                        Budget: {fmtCurrency(r.lead.budget, r.lead.currency)}
                        {overBudget && ' ⚠ over'}
                      </div>
                    )}
                    {r.record?.bdRevisionNote && (
                      <div className="text-xs text-red-600 mt-0.5 max-w-xs truncate">
                        Revision: {r.record.bdRevisionNote}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{r.assignee.name}</td>
                  <td className="px-3 py-3 text-gray-500">{r.requester.name}</td>
                  <td className="text-center px-3 py-3">
                    <span className={`badge text-xs ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3 text-gray-600">
                    {r.record
                      ? <span title={`${r.record.totalHoursRaw}h raw + ${r.record.bufferPct}% buffer`}>
                          {r.record.totalHoursFinal}h
                        </span>
                      : '—'}
                  </td>
                  <td className={`text-center px-3 py-3 font-medium ${overBudget ? 'text-red-600' : 'text-gray-800'}`}>
                    {r.record?.totalPriceFinal
                      ? fmtCurrency(r.record.totalPriceFinal, r.record.currency)
                      : '—'}
                  </td>
                  <td className={`text-center px-3 py-3 text-xs font-medium capitalize ${RISK_COLORS[r.record?.overallRisk ?? ''] ?? 'text-gray-300'}`}>
                    {r.record?.overallRisk ?? '—'}
                  </td>
                  <td className="text-center px-3 py-3 text-gray-400 text-xs">
                    {r.record ? `${r.record.lines.length} lines` : '—'}
                  </td>
                  <td className="text-center px-3 py-3 text-gray-400 text-xs">
                    {fmtDate(r.createdAt)}
                    {r.dueBy && (
                      <div className={`text-xs mt-0.5 ${new Date(r.dueBy) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                        Due: {fmtDate(r.dueBy)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/estimate/${r.leadId}`}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                    >
                      {r.status === 'revision' ? 'Revise →'
                        : r.status === 'pending' || r.status === 'in_progress' ? 'Fill estimate →'
                        : r.status === 'confirmed' ? 'Review →'
                        : 'View →'}
                    </Link>
                  </td>
                </tr>
              )
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                  No estimates yet.{' '}
                  <Link href="/pipeline" className="text-blue-600 hover:underline">
                    Request one from a lead →
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
