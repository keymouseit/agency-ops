'use client'

import { useState } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  subMonths, 
  addMonths, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval, 
  isWithinInterval,
  parseISO
} from 'date-fns'
import toast, { Toaster } from 'react-hot-toast'

export default function LeaveDashboardClient({
  memberId,
  isAdmin,
  myLeaves,
  accrued,
  used,
  allPendingLeaves,
  allMembers,
  allLeaves
}: {
  memberId: string
  isAdmin: boolean
  myLeaves: any[]
  accrued: number
  used: number
  allPendingLeaves: any[]
  allMembers: any[]
  allLeaves?: any[]
}) {
  const [tab, setTab] = useState<'my_leaves' | 'admin'>('my_leaves')
  
  // Apply/Edit Leave Form State
  const [leaveType, setLeaveType] = useState('full_day')
  const [timeSlot, setTimeSlot] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Edit Modal State
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null)

  // Audit Log Modal State
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [selectedLeaveForModal, setSelectedLeaveForModal] = useState<any>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  // Admin Manual Entry State
  const [isManualLogModalOpen, setIsManualLogModalOpen] = useState(false)
  const [adminMemberId, setAdminMemberId] = useState(memberId)

  // Confirm Approval/Rejection Modal State
  const [confirmModal, setConfirmModal] = useState<{ leaveId: string; status: 'approved' | 'rejected' } | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  // Report Filter & View State
  const [reportEmployeeFilter, setReportEmployeeFilter] = useState('all')
  const [reportView, setReportView] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Reset form to defaults
  const resetForm = () => {
    setLeaveType('full_day')
    setTimeSlot('')
    setStartDate('')
    setEndDate('')
    setReason('')
    setEditingLeaveId(null)
    setError('')
  }

  // Open Edit Modal
  const openEditModal = (leave: any) => {
    setLeaveType(leave.leaveType)
    setTimeSlot(leave.timeSlot || '')
    setStartDate(new Date(leave.startDate).toISOString().split('T')[0])
    setEndDate(new Date(leave.endDate).toISOString().split('T')[0])
    setReason(leave.reason || '')
    setEditingLeaveId(leave.id)
  }

  // View History Modal
  const viewHistory = async (leave: any) => {
    setSelectedLeaveForModal(leave)
    setAuditLoading(true)
    try {
      const res = await fetch(`/api/leaves/${leave.id}/audit`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAuditLogs(data)
    } catch (err: unknown) {
      toast.error('Failed to load history')
    } finally {
      setAuditLoading(false)
    }
  }

  async function handleApplyLeave(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const payload = {
        memberId: tab === 'admin' ? adminMemberId : memberId,
        leaveType,
        timeSlot: (leaveType === 'half_day' || leaveType === 'short_leave') ? timeSlot : undefined,
        startDate,
        endDate,
        reason,
        isAdmin: tab === 'admin'
      }

      const url = editingLeaveId ? `/api/leaves/${editingLeaveId}` : '/api/leaves'
      const method = editingLeaveId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      
      toast.success(editingLeaveId ? 'Leave updated successfully!' : 'Leave requested successfully!')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitApproveReject() {
    if (!confirmModal) return
    const { leaveId, status } = confirmModal
    
    if (status === 'rejected' && !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setIsConfirming(true)
    try {
      const res = await fetch(`/api/leaves/${leaveId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedById: memberId, status, approvalNotes: status === 'rejected' ? rejectionReason : '' })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      
      toast.success(`Leave ${status}!`)
      setConfirmModal(null)
      setRejectionReason('')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsConfirming(false)
    }
  }

  const formatLeaveType = (type: string, slot?: string) => {
    let base = type.replace('_', ' ')
    if (slot) {
      base += ` (${slot.replace('_', ' ')})`
    }
    return base
  }

  // --- Calendar Helpers ---
  const filteredLeavesForReports = (allLeaves || []).filter(l => reportEmployeeFilter === 'all' || l.memberId === reportEmployeeFilter)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDateCalendar = startOfWeek(monthStart)
  const endDateCalendar = endOfWeek(monthEnd)
  
  const calendarDays = eachDayOfInterval({ start: startDateCalendar, end: endDateCalendar })

  const getLeavesForDay = (day: Date) => {
    return filteredLeavesForReports.filter(l => {
      const s = new Date(l.startDate)
      const e = new Date(l.endDate)
      // Normalize to midnight for accurate comparison
      s.setHours(0,0,0,0)
      e.setHours(0,0,0,0)
      const current = new Date(day)
      current.setHours(0,0,0,0)
      return isWithinInterval(current, { start: s, end: e })
    })
  }

  // Calculate pending days for the user
  const pendingDays = myLeaves
    .filter(l => l.status === 'pending')
    .reduce((total, l) => {
      let days = 1;
      if (l.leaveType === 'short_leave') days = 0.25;
      else if (l.leaveType === 'half_day') days = 0.5;
      return total + days;
    }, 0);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <Toaster position="bottom-right" />

      {/* Confirm Approve/Reject Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden">
            <div className={`px-6 py-4 border-b border-gray-100 ${confirmModal.status === 'approved' ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
              <h2 className="text-lg font-bold text-gray-900 capitalize flex items-center gap-2">
                {confirmModal.status === 'approved' ? '✅ Approve Leave' : '❌ Reject Leave'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to <strong>{confirmModal.status}</strong> this leave request?
                {confirmModal.status === 'approved' && " The employee will be notified and this leave will be recorded."}
              </p>

              {confirmModal.status === 'rejected' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason for Rejection (Required)</label>
                  <textarea 
                    autoFocus
                    required 
                    value={rejectionReason} 
                    onChange={e => setRejectionReason(e.target.value)} 
                    rows={3} 
                    className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-red-500 focus:ring-red-500 px-3 py-2.5" 
                    placeholder="Please explain why this leave is being rejected..." 
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  disabled={isConfirming}
                  onClick={() => {
                    setConfirmModal(null)
                    setRejectionReason('')
                  }} 
                  className="w-full rounded-xl py-3 text-sm font-bold bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={submitApproveReject}
                  disabled={isConfirming || (confirmModal.status === 'rejected' && !rejectionReason.trim())} 
                  className={`w-full rounded-xl py-3 text-sm font-bold text-white shadow-md transition-all border-none disabled:opacity-50
                    ${confirmModal.status === 'approved' 
                      ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20 hover:shadow-green-600/30' 
                      : 'bg-red-600 hover:bg-red-700 shadow-red-600/20 hover:shadow-red-600/30'}`}
                >
                  {isConfirming ? 'Processing...' : `Confirm ${confirmModal.status === 'approved' ? 'Approval' : 'Rejection'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Leave Modal */}
      {editingLeaveId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Edit Pending Leave</h2>
            {error && <div className="mb-5 text-sm text-red-600 bg-red-50 p-3 rounded-xl ring-1 ring-red-600/10">{error}</div>}
            
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
                <select value={leaveType} onChange={e => { setLeaveType(e.target.value); setTimeSlot(''); }} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5">
                  <option value="full_day">Full Day</option>
                  <option value="half_day">Half Day</option>
                  <option value="short_leave">Short Leave (2 hours)</option>
                </select>
              </div>

              {leaveType === 'half_day' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Slot</label>
                  <select required value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-blue-50/30">
                    <option value="" disabled>Select a slot</option>
                    <option value="before_lunch">Before Lunch</option>
                    <option value="after_lunch">After Lunch</option>
                  </select>
                </div>
              )}

              {leaveType === 'short_leave' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Slot</label>
                  <select required value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-blue-50/30">
                    <option value="" disabled>Select a slot</option>
                    <option value="morning">Morning</option>
                    <option value="in_between_the_day">In between the day</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || new Date().toISOString().split('T')[0]} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                <textarea required value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="w-full rounded-xl py-3 text-sm font-bold bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="w-full rounded-xl py-3 text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all bg-gray-900 border-none hover:bg-gray-800 text-white">
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {selectedLeaveForModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 max-h-[80vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Leave Details & Logs</h2>
              <button onClick={() => setSelectedLeaveForModal(null)} className="text-gray-400 hover:text-gray-600 bg-white shadow-sm ring-1 ring-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              
              {/* Leave Summary Card */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{selectedLeaveForModal.member?.name || 'Leave Request'}</h3>
                    <p className="text-xs text-gray-500 capitalize">{formatLeaveType(selectedLeaveForModal.leaveType, selectedLeaveForModal.timeSlot)}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ring-1 ring-inset
                    ${selectedLeaveForModal.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                      selectedLeaveForModal.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                      'bg-red-50 text-red-700 ring-red-600/20'}`}>
                    {selectedLeaveForModal.status}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold text-gray-600 w-16">Dates:</span>
                    <span className="text-gray-900">
                      {format(new Date(selectedLeaveForModal.startDate), 'MMM d, yyyy')}
                      {selectedLeaveForModal.startDate !== selectedLeaveForModal.endDate && ` to ${format(new Date(selectedLeaveForModal.endDate), 'MMM d, yyyy')}`}
                    </span>
                  </div>
                  {selectedLeaveForModal.reason && (
                    <div className="flex gap-2 text-sm">
                      <span className="font-semibold text-gray-600 w-16">Reason:</span>
                      <span className="text-gray-900 line-clamp-2">{selectedLeaveForModal.reason}</span>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Timeline</h3>
              
              {auditLoading ? (
                <div className="text-center text-sm text-gray-500 py-10">Loading logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-10">No history found for this request.</div>
              ) : (
                <div className="space-y-6">
                  {auditLogs.map((log, index) => (
                    <div key={log.id} className="relative pl-8">
                      {/* Timeline line */}
                      {index !== auditLogs.length - 1 && (
                        <div className="absolute top-6 left-[11px] bottom-[-24px] w-0.5 bg-gray-100"></div>
                      )}
                      {/* Timeline dot */}
                      <div className={`absolute top-1.5 left-0 w-[22px] h-[22px] rounded-full ring-4 ring-white flex items-center justify-center
                        ${log.action === 'created' ? 'bg-blue-100 text-blue-600' : 
                          log.action === 'updated' ? 'bg-purple-100 text-purple-600' :
                          'bg-green-100 text-green-600'}`}>
                        <div className={`w-2 h-2 rounded-full 
                          ${log.action === 'created' ? 'bg-blue-600' : 
                          log.action === 'updated' ? 'bg-purple-600' :
                          'bg-green-600'}`}></div>
                      </div>
                      
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {log.action === 'created' && 'Leave Applied'}
                          {log.action === 'updated' && 'Leave Updated'}
                          {log.action === 'status_changed' && 'Status Changed'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 mb-2">
                          By <span className="font-medium text-gray-700">{log.user?.name || 'Unknown'}</span> on {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                        </div>
                        
                        {log.changes && (
                          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 font-mono space-y-1 ring-1 ring-inset ring-gray-900/5">
                            {Object.entries(JSON.parse(log.changes)).map(([key, val]: any) => (
                              <div key={key}>
                                <span className="font-semibold text-gray-900 capitalize">{key}:</span>{' '}
                                {typeof val === 'object' && val !== null ? (
                                  <span><span className="line-through text-red-500 opacity-70">{val.old}</span> → <span className="text-green-600">{val.new}</span></span>
                                ) : (
                                  <span>{val}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {log.metadata && JSON.parse(log.metadata).notes && (
                          <div className="mt-2 text-xs text-gray-600 italic border-l-2 border-gray-300 pl-2">
                            "{JSON.parse(log.metadata).notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your time off, view balances, and track requests.</p>
        </div>
        
        {isAdmin && (
          <div className="flex bg-gray-100/80 p-1 rounded-xl ring-1 ring-gray-200/50">
            <button
              onClick={() => setTab('my_leaves')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'my_leaves' ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
            >
              My Leaves
            </button>
            <button
              onClick={() => setTab('admin')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'admin' ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
            >
              Admin Hub
            </button>
          </div>
        )}
      </div>

      {tab === 'my_leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            {/* Balance Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-gray-900/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <svg className="w-24 h-24 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
              </div>
              <h2 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Your Balance</h2>
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-3xl font-bold text-gray-900">{Math.max(0, accrued - used)}</div>
                  <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full inline-flex mt-1 ring-1 ring-green-600/10">Available Days</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Accrued</div>
                  <div className="text-lg font-bold text-gray-700 mt-1">{accrued}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Used</div>
                  <div className="text-lg font-bold text-red-600 mt-1">{used}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pending</div>
                  <div className="text-lg font-bold text-amber-600 mt-1">{pendingDays}</div>
                </div>
              </div>
            </div>

            {/* Apply Leave Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-gray-900/5">
              <h2 className="text-base font-bold text-gray-900 mb-5">Apply for Leave</h2>
              {error && <div className="mb-5 text-sm text-red-600 bg-red-50 p-3 rounded-xl ring-1 ring-red-600/10">{error}</div>}
              
              <form onSubmit={handleApplyLeave} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
                  <select value={leaveType} onChange={e => { setLeaveType(e.target.value); setTimeSlot(''); }} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5">
                    <option value="full_day">Full Day</option>
                    <option value="half_day">Half Day</option>
                    <option value="short_leave">Short Leave (2 hours)</option>
                  </select>
                </div>

                {leaveType === 'half_day' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Slot</label>
                    <select required value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-blue-50/30">
                      <option value="" disabled>Select a slot</option>
                      <option value="before_lunch">Before Lunch</option>
                      <option value="after_lunch">After Lunch</option>
                    </select>
                  </div>
                )}

                {leaveType === 'short_leave' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Slot</label>
                    <select required value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-blue-50/30">
                      <option value="" disabled>Select a slot</option>
                      <option value="morning">Morning</option>
                      <option value="in_between_the_day">In between the day</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date</label>
                    <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || new Date().toISOString().split('T')[0]} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                  <textarea required value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" placeholder="e.g., Medical appointment" />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full btn btn-primary rounded-xl py-3 text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all bg-gray-900 border-none hover:bg-gray-800 text-white">
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/30">
                <h2 className="text-base font-bold text-gray-900">My Leave History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left">Type & Slot</th>
                      <th className="px-6 py-4 text-left">Dates</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {myLeaves.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500 bg-gray-50/30">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-3xl mb-3">🌴</span>
                            <span className="font-medium text-gray-900">No leaves found</span>
                            <span className="text-xs text-gray-400 mt-1">You haven't requested any time off yet.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      myLeaves.map(l => (
                        <tr key={l.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 capitalize text-gray-900 font-medium">
                            {formatLeaveType(l.leaveType, l.timeSlot)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            <span className="font-medium text-gray-900">{format(new Date(l.startDate), 'MMM d, yyyy')}</span>
                            {l.startDate !== l.endDate && ` to ${format(new Date(l.endDate), 'MMM d, yyyy')}`}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ring-1 ring-inset
                              ${l.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                                l.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                                'bg-red-50 text-red-700 ring-red-600/20'}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            <button onClick={() => viewHistory(l)} className="text-gray-500 hover:text-blue-600 font-bold text-[11px] uppercase tracking-wide bg-gray-100 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1">
                              Logs
                            </button>
                            {l.status === 'pending' && (
                              <button onClick={() => openEditModal(l)} className="text-gray-700 font-bold text-[11px] uppercase tracking-wide bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'admin' && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-gray-900">Pending Approvals</h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{allPendingLeaves.length} Requests</span>
              </div>
              <button onClick={() => setIsManualLogModalOpen(true)} className="text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Log Leave Manually
              </button>
            </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left">Employee</th>
                      <th className="px-6 py-4 text-left">Type & Slot</th>
                      <th className="px-6 py-4 text-left">Dates</th>
                      <th className="px-6 py-4 text-left">Reason</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {allPendingLeaves.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 bg-gray-50/30">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-3xl mb-3">✅</span>
                            <span className="font-medium text-gray-900">All caught up!</span>
                            <span className="text-xs text-gray-400 mt-1">There are no pending leave requests.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      allPendingLeaves.map(l => (
                        <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{l.member.name}</div>
                          </td>
                          <td className="px-6 py-4 capitalize text-gray-600 font-medium">
                            {formatLeaveType(l.leaveType, l.timeSlot)}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            <div className="font-semibold text-gray-900">{format(new Date(l.startDate), 'MMM d')}</div>
                            {l.startDate !== l.endDate && <div className="text-xs text-gray-400 mt-0.5">to {format(new Date(l.endDate), 'MMM d')}</div>}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs max-w-[180px] truncate" title={l.reason}>{l.reason}</td>
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            <button onClick={() => viewHistory(l)} className="text-gray-500 hover:text-blue-600 font-bold text-xs bg-gray-100 hover:bg-blue-50 px-2 py-1.5 rounded-lg transition-colors mr-1">Logs</button>
                            <button onClick={() => setConfirmModal({ leaveId: l.id, status: 'approved' })} className="text-green-700 font-bold text-xs bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg ring-1 ring-inset ring-green-600/20 transition-colors">Approve</button>
                            <button onClick={() => setConfirmModal({ leaveId: l.id, status: 'rejected' })} className="text-red-700 font-bold text-xs bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg ring-1 ring-inset ring-red-600/20 transition-colors">Reject</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      )}

      {tab === 'admin' && allLeaves && (
        <div className="mt-8 bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-bold text-gray-900">All Company Leaves</h2>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter:</label>
                <select value={reportEmployeeFilter} onChange={e => setReportEmployeeFilter(e.target.value)} className="text-sm font-medium rounded-xl border-gray-200 py-1.5 pl-3 pr-8 focus:border-blue-500 focus:ring-blue-500 bg-white">
                  <option value="all">All Employees</option>
                  {allMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex bg-gray-100 p-1 rounded-lg ring-1 ring-gray-200">
                <button
                  onClick={() => setReportView('list')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${reportView === 'list' ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setReportView('calendar')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${reportView === 'calendar' ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Calendar
                </button>
              </div>
            </div>
          </div>

          {reportView === 'list' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-left">Employee</th>
                    <th className="px-6 py-4 text-left">Type & Slot</th>
                    <th className="px-6 py-4 text-left">Dates</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredLeavesForReports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 bg-gray-50/30">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-3xl mb-3">📭</span>
                          <span className="font-medium text-gray-900">No leaves found</span>
                          <span className="text-xs text-gray-400 mt-1">Try changing your filters.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLeavesForReports.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{l.member.name}</div>
                        </td>
                        <td className="px-6 py-4 capitalize text-gray-700 font-medium">
                          {formatLeaveType(l.leaveType, l.timeSlot)}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          <span className="font-semibold text-gray-900">{format(new Date(l.startDate), 'MMM d, yyyy')}</span>
                          {l.startDate !== l.endDate && <span className="text-gray-500"> to {format(new Date(l.endDate), 'MMM d, yyyy')}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ring-1 ring-inset
                            ${l.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                              l.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                              'bg-red-50 text-red-700 ring-red-600/20'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <button onClick={() => viewHistory(l)} className="text-gray-500 hover:text-blue-600 font-bold text-xs bg-gray-100 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">Logs</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              {/* Calendar Controls */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h3>
                <div className="flex space-x-2">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 ring-1 ring-gray-200 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-2 text-sm font-bold rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 ring-1 ring-gray-200 transition-colors">Today</button>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 ring-1 ring-gray-200 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden ring-1 ring-gray-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="bg-gray-50 py-2 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
                
                {calendarDays.map((day, dayIdx) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isToday = isSameDay(day, new Date())
                  const dayLeaves = getLeavesForDay(day)

                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`min-h-[100px] bg-white p-2 flex flex-col ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-400' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-900'}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px]">
                        {dayLeaves.map(l => (
                          <div 
                            key={l.id}
                            onClick={() => viewHistory(l)}
                            className={`text-xs px-2 py-1 rounded truncate cursor-pointer font-medium hover:ring-1 hover:ring-inset hover:ring-black/20 transition-all
                              ${l.status === 'approved' ? 'bg-green-100 text-green-800' : 
                                l.status === 'pending' ? 'bg-amber-100 text-amber-800' : 
                                'bg-red-100 text-red-800'}`}
                            title={`${l.member.name} - ${formatLeaveType(l.leaveType, l.timeSlot)}`}
                          >
                            {l.member.name.split(' ')[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Log Leave Manually Modal */}
      {isManualLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl ring-1 ring-gray-900/10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Log Leave Manually</h2>
                <p className="text-xs text-gray-500">Bypass approval process and add a record directly.</p>
              </div>
              <button onClick={() => setIsManualLogModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {error && <div className="mb-5 text-sm text-red-600 bg-red-50 p-3 rounded-xl ring-1 ring-red-600/10">{error}</div>}
            
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Employee</label>
                <select value={adminMemberId} onChange={e => setAdminMemberId(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-gray-50">
                  {allMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
                <select value={leaveType} onChange={e => { setLeaveType(e.target.value); setTimeSlot(''); }} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5">
                  <option value="full_day">Full Day</option>
                  <option value="half_day">Half Day</option>
                  <option value="short_leave">Short Leave (2 hours)</option>
                </select>
              </div>
              
              {leaveType === 'half_day' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Slot</label>
                  <select required value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-blue-50/30">
                    <option value="" disabled>Select a slot</option>
                    <option value="before_lunch">Before Lunch</option>
                    <option value="after_lunch">After Lunch</option>
                  </select>
                </div>
              )}

              {leaveType === 'short_leave' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Slot</label>
                  <select required value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-blue-50/30">
                    <option value="" disabled>Select a slot</option>
                    <option value="morning">Morning</option>
                    <option value="in_between_the_day">In between the day</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason (Optional)</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" placeholder="e.g., Sick leave" />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsManualLogModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all bg-gray-900 hover:bg-gray-800 text-white border-none flex-1">
                  {isSubmitting ? 'Logging...' : 'Force Log Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
