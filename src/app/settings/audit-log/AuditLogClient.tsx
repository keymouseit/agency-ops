'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'

type AuditLog = {
  id: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  action: string
  entityType: string
  entityId: string
  entityName: string | null
  timestamp: string
  changes: Record<string, { old: any; new: any }> | null
  metadata: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
  user?: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

type Member = {
  id: string
  name: string
  email: string
}

const ENTITY_TYPES = [
  'All',
  'TeamMember',
  'Project',
  'Lead',
  'Estimate',
  'TestCycle',
  'ReleaseSignOff',
  'Goal',
  'Settings',
  'ScopeChange',
  'CheckIn',
  'PostDeliveryIssue',
]

const ACTIONS = [
  'All',
  'created',
  'updated',
  'deleted',
  'status_changed',
  'activated',
  'deactivated',
  'signed_off',
  'approved',
  'rejected',
  'submitted',
  'password_changed',
]

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
  status_changed: 'bg-purple-100 text-purple-800',
  activated: 'bg-green-100 text-green-800',
  deactivated: 'bg-red-100 text-red-800',
  signed_off: 'bg-teal-100 text-teal-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  submitted: 'bg-blue-100 text-blue-800',
  password_changed: 'bg-amber-100 text-amber-800',
}

export default function AuditLogClient({ members }: { members: Member[] }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  // Filters
  const [userId, setUserId] = useState('')
  const [entityType, setEntityType] = useState('All')
  const [action, setAction] = useState('All')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState('30') // days

  useEffect(() => {
    fetchLogs()
  }, [page, userId, entityType, action, dateRange])

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      })

      if (userId) params.append('userId', userId)
      if (entityType !== 'All') params.append('entityType', entityType)
      if (action !== 'All') params.append('action', action)
      if (search) params.append('search', search)

      if (dateRange !== 'all') {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - parseInt(dateRange))
        params.append('startDate', startDate.toISOString())
        params.append('endDate', endDate.toISOString())
      }

      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error('Failed to fetch logs')

      const data = await res.json()
      setLogs(data.logs)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      alert('Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    setPage(1)
    fetchLogs()
  }

  function handleReset() {
    setUserId('')
    setEntityType('All')
    setAction('All')
    setSearch('')
    setDateRange('30')
    setPage(1)
    fetchLogs()
  }

  async function exportToCSV() {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // Export all (up to 10k)
      })

      if (userId) params.append('userId', userId)
      if (entityType !== 'All') params.append('entityType', entityType)
      if (action !== 'All') params.append('action', action)
      if (search) params.append('search', search)

      if (dateRange !== 'all') {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - parseInt(dateRange))
        params.append('startDate', startDate.toISOString())
        params.append('endDate', endDate.toISOString())
      }

      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error('Failed to fetch logs for export')

      const data = await res.json()

      // Convert to CSV
      const headers = ['Timestamp', 'User', 'Email', 'Action', 'Entity Type', 'Entity Name', 'Entity ID', 'Changes', 'IP Address']
      const rows = data.logs.map((log: AuditLog) => [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.userName || 'System',
        log.userEmail || '',
        log.action,
        log.entityType,
        log.entityName || '',
        log.entityId,
        log.changes ? JSON.stringify(log.changes) : '',
        log.ipAddress || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n')

      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export logs:', error)
      alert('Failed to export logs')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete audit trail of all system changes · {total.toLocaleString()} entries
          </p>
        </div>
        <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to Settings
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          {/* User Filter */}
          <div>
            <label className="label text-xs">User</label>
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="input text-sm"
            >
              <option value="">All Users</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="label text-xs">Entity Type</label>
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value)}
              className="input text-sm"
            >
              {ENTITY_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="label text-xs">Action</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="input text-sm"
            >
              {ACTIONS.map(act => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="label text-xs">Date Range</label>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="input text-sm"
            >
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="label text-xs">Search</label>
            <input
              type="text"
              placeholder="Name, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSearch} className="btn-primary text-sm">
            Apply Filters
          </button>
          <button onClick={handleReset} className="btn-secondary text-sm">
            Reset
          </button>
          <button onClick={exportToCSV} className="btn-secondary text-sm ml-auto">
            Export to CSV
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card p-12 text-center">
          <div className="text-gray-400 text-sm">Loading audit logs...</div>
        </div>
      )}

      {/* Logs Table */}
      {!loading && logs.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-gray-400 text-sm">No audit logs found matching your filters.</div>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                    <th className="text-left px-3 py-3 font-medium">User</th>
                    <th className="text-left px-3 py-3 font-medium">Action</th>
                    <th className="text-left px-3 py-3 font-medium">Entity</th>
                    <th className="text-left px-3 py-3 font-medium">Name</th>
                    <th className="text-center px-3 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">
                          {log.userName || 'System'}
                        </div>
                        <div className="text-xs text-gray-400">{log.userEmail}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`badge text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{log.entityType}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">
                          {log.entityName || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">{log.entityId.substring(0, 8)}...</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages} · {total.toLocaleString()} total entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Audit Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Timestamp */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Timestamp</div>
                <div className="text-gray-900">{format(new Date(selectedLog.timestamp), 'EEEE, MMMM d, yyyy · HH:mm:ss')}</div>
              </div>

              {/* User */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">User</div>
                <div className="text-gray-900 font-medium">{selectedLog.userName || 'System'}</div>
                {selectedLog.userEmail && (
                  <div className="text-gray-600 text-xs">{selectedLog.userEmail}</div>
                )}
              </div>

              {/* Action & Entity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Action</div>
                  <span className={`badge ${ACTION_COLORS[selectedLog.action] || 'bg-gray-100 text-gray-600'}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Entity Type</div>
                  <div className="text-gray-900">{selectedLog.entityType}</div>
                </div>
              </div>

              {/* Entity Details */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Entity</div>
                <div className="text-gray-900 font-medium">{selectedLog.entityName || 'N/A'}</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {selectedLog.entityId}</div>
              </div>

              {/* Changes */}
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Changes</div>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {Object.entries(selectedLog.changes).map(([field, change]) => (
                      <div key={field}>
                        <div className="text-xs font-medium text-gray-700 mb-1">{field}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex-1 bg-red-50 border border-red-100 rounded px-2 py-1">
                            <span className="text-red-600">Old: </span>
                            <span className="text-gray-900">{JSON.stringify(change.old)}</span>
                          </div>
                          <span className="text-gray-400">→</span>
                          <div className="flex-1 bg-green-50 border border-green-100 rounded px-2 py-1">
                            <span className="text-green-600">New: </span>
                            <span className="text-gray-900">{JSON.stringify(change.new)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Metadata</div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* IP Address */}
              {selectedLog.ipAddress && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">IP Address</div>
                  <div className="text-gray-900 font-mono text-xs">{selectedLog.ipAddress}</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="btn-secondary text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
