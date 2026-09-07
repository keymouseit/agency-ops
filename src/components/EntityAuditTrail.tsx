'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { formatQAActivitySummary } from '@/lib/qa-audit-format'

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
  user?: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

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

interface EntityAuditTrailProps {
  entityType: string
  entityId: string
  title?: string
  refreshKey?: number
}

export default function EntityAuditTrail({ entityType, entityId, title = 'Change History', refreshKey }: EntityAuditTrailProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [entityType, entityId, refreshKey])

  async function fetchLogs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/audit/${entityType}/${entityId}`)
      if (!res.ok) throw new Error('Failed to fetch logs')

      const data = await res.json()
      setLogs(data.logs)
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      setLogs([])
      setError('Change history is unavailable right now.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-sm text-gray-400">Loading change history...</div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-sm text-gray-400">{error || 'No changes recorded yet.'}</div>
      </div>
    )
  }

  const displayLogs = expanded ? logs : logs.slice(0, 5)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div className="text-xs text-gray-400">{logs.length} {logs.length === 1 ? 'entry' : 'entries'}</div>
      </div>

      <div className="space-y-3">
        {displayLogs.map(log => {
          const qaSummary = formatQAActivitySummary(log.metadata)
          return (
          <div
            key={log.id}
            className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
          >
            {/* Timeline dot */}
            <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              {/* Action & User */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`badge text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                  {log.action}
                </span>
                <span className="text-xs text-gray-600">
                  by <span className="font-medium text-gray-900">{log.userName || 'System'}</span>
                </span>
              </div>

              {qaSummary && (
                <p className="text-sm text-gray-800 mb-1">{qaSummary}</p>
              )}

              {/* Changes Summary */}
              {log.changes && Object.keys(log.changes).length > 0 && (
                <div className="text-xs text-gray-600 mb-1">
                  {Object.entries(log.changes).map(([field, change], i) => (
                    <div key={field}>
                      {field === 'status' ? (
                        <>
                          Project status changed from{' '}
                          <span className="font-medium">
                            {String(change.old || 'Not Set')}
                          </span>{' '}
                          →{' '}
                          <span className="font-medium text-green-600">
                            {String(change.new)}
                          </span>
                        </>
                      ) : field === "name" ? (
                        <>
                          <span className="font-medium">{field}</span> changed <span className="font-medium">
                            {String(change.old || 'Not Set')}
                          </span>{' '}
                          →{' '}
                          <span className="font-medium text-green-600">
                            {String(change.new)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{field}</span> changed
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div className="text-xs text-gray-400">
                {format(new Date(log.timestamp), 'MMM d, yyyy · HH:mm')}
              </div>
            </div>

            {/* View Button */}
            <button
              onClick={() => setSelectedLog(log)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0"
            >
              Details
            </button>
          </div>
        )})}
      </div>

      {/* Show More/Less Button */}
      {logs.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800 mt-3 w-full text-center"
        >
          {expanded ? 'Show less' : `Show ${logs.length - 5} more...`}
        </button>
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
              <h3 className="text-lg font-semibold text-gray-900">Change Details</h3>
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

              {/* Action */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Action</div>
                <span className={`badge ${ACTION_COLORS[selectedLog.action] || 'bg-gray-100 text-gray-600'}`}>
                  {selectedLog.action}
                </span>
              </div>

              {formatQAActivitySummary(selectedLog.metadata) && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Summary</div>
                  <p className="text-gray-900">{formatQAActivitySummary(selectedLog.metadata)}</p>
                </div>
              )}

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
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Additional Context</div>
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
