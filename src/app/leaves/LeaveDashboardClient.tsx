'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { leaveRequestDayCost, SHORT_LEAVE_MONTHLY_CAP } from '@/lib/leave-math'
import { formatIstDate, formatIstDateTimeShort, formatIstLeaveRange, istDateInputValue, istYearAndMonth } from '@/lib/ist'
import { notifyLeavesPendingChanged } from '@/hooks/usePendingLeaveCount'
import NavCountBadge from '@/components/NavCountBadge'
import LeaveHourPolicyCard from '@/components/LeaveHourPolicyCard'

export default function LeaveDashboardClient({
  memberId,
  isAdmin,
  canManageBalances = false,
  myLeaves,
  accrued,
  used,
  shortLeaves = 0,
  allPendingLeaves,
  allMembers,
  allLeaves
}: {
  memberId: string
  isAdmin: boolean
  canManageBalances?: boolean
  myLeaves: any[]
  accrued: number
  used: number
  shortLeaves?: number
  allPendingLeaves: any[]
  allMembers: any[]
  allLeaves?: any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'my_leaves' | 'admin'>(
    isAdmin && allPendingLeaves.length > 0 ? 'admin' : 'my_leaves'
  )
  const [leaves, setLeaves] = useState(myLeaves)
  const [pendingLeaves, setPendingLeaves] = useState(allPendingLeaves)
  const [companyLeaves, setCompanyLeaves] = useState(allLeaves || [])
  const decidedPendingIds = useRef(new Set<string>())

  useEffect(() => {
    setLeaves(myLeaves)
  }, [myLeaves])

  useEffect(() => {
    setPendingLeaves(
      allPendingLeaves.filter(l => l.status === 'pending' && !decidedPendingIds.current.has(l.id))
    )
  }, [allPendingLeaves])

  useEffect(() => {
    setCompanyLeaves(allLeaves || [])
  }, [allLeaves])

  const refetchLeaveLists = useCallback(async () => {
    try {
      const pendingRes = await fetch('/api/leaves?status=pending', { cache: 'no-store' })
      if (pendingRes.ok) {
        const rows = await pendingRes.json()
        if (Array.isArray(rows)) {
          setPendingLeaves(
            rows.filter((l: { id: string; status?: string }) =>
              l.status === 'pending' && !decidedPendingIds.current.has(l.id)
            )
          )
        }
      }

      if (isAdmin) {
        const allRes = await fetch('/api/leaves', { cache: 'no-store' })
        if (allRes.ok) {
          const all = await allRes.json()
          if (Array.isArray(all)) {
            setCompanyLeaves(all)
            setLeaves(all.filter((l: { memberId?: string }) => l.memberId === memberId))
          }
        }
      } else {
        const mineRes = await fetch('/api/leaves', { cache: 'no-store' })
        if (mineRes.ok) {
          const mine = await mineRes.json()
          if (Array.isArray(mine)) setLeaves(mine)
        }
      }
    } finally {
      notifyLeavesPendingChanged()
      router.refresh()
    }
  }, [isAdmin, memberId, router])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void refetchLeaveLists()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetchLeaveLists])
  
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
  const [deleteConfirmLeave, setDeleteConfirmLeave] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [revokeConfirmLeave, setRevokeConfirmLeave] = useState<any | null>(null)
  const [revokeNotes, setRevokeNotes] = useState('')
  const [isRevoking, setIsRevoking] = useState(false)

  // Audit Log Modal State
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [selectedLeaveForModal, setSelectedLeaveForModal] = useState<any>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  // Admin Manual Entry State
  const [isManualLogModalOpen, setIsManualLogModalOpen] = useState(false)
  const [adminMemberId, setAdminMemberId] = useState(memberId)

  // Confirm Approval/Rejection Modal State
  const [confirmModal, setConfirmModal] = useState<{ leaveId: string; status: 'approved' | 'rejected' } | null>(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  // Report Filter & View State
  const [reportEmployeeFilter, setReportEmployeeFilter] = useState('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [adminSection, setAdminSection] = useState<'approvals' | 'history' | 'calendar'>('approvals')
  const [myLeaveFilter, setMyLeaveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  const isSameDayLeave = leaveType === 'half_day' || leaveType === 'short_leave'

  // Half day / short leave are always a single day — keep end locked to start
  useEffect(() => {
    if (isSameDayLeave && startDate) {
      setEndDate(startDate)
    }
  }, [isSameDayLeave, startDate])

  function formatLeaveDates(start: string | Date, end: string | Date) {
    return formatIstLeaveRange(start, end)
  }

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
    setStartDate(istDateInputValue(leave.startDate))
    setEndDate(istDateInputValue(leave.endDate))
    setReason(leave.reason || '')
    setEditingLeaveId(leave.id)
  }

  async function confirmDeleteLeave() {
    const leave = deleteConfirmLeave
    if (!leave || leave.status === 'approved') return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/leaves/${leave.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to delete')

      setLeaves(prev => prev.filter(l => l.id !== leave.id))
      setPendingLeaves(prev => prev.filter(l => l.id !== leave.id))
      setCompanyLeaves(prev => prev.filter(l => l.id !== leave.id))
      decidedPendingIds.current.add(leave.id)
      if (editingLeaveId === leave.id) resetForm()
      if (selectedLeaveForModal?.id === leave.id) setSelectedLeaveForModal(null)
      setDeleteConfirmLeave(null)
      toast.success('Leave request deleted')
      void refetchLeaveLists()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setIsDeleting(false)
    }
  }

  async function confirmRevokeLeave() {
    const leave = revokeConfirmLeave
    if (!leave) return
    if (!revokeNotes.trim()) {
      toast.error('Please add a reason for revoking')
      return
    }
    setIsRevoking(true)
    try {
      const res = await fetch(`/api/leaves/${leave.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: revokeNotes.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to revoke')

      setCompanyLeaves(prev =>
        prev.map(l => (l.id === leave.id ? { ...l, ...data, status: 'cancelled' } : l))
      )
      setLeaves(prev =>
        prev.map(l => (l.id === leave.id ? { ...l, ...data, status: 'cancelled' } : l))
      )
      setRevokeConfirmLeave(null)
      setRevokeNotes('')
      toast.success('Leave revoked and balance updated')
      void refetchLeaveLists()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke')
    } finally {
      setIsRevoking(false)
    }
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
      if (isManualLogModalOpen && !reason.trim()) {
        throw new Error('Reason is required when logging leave manually')
      }

      const targetMemberId = tab === 'admin' || isManualLogModalOpen ? adminMemberId : memberId
      const sameDay = leaveType === 'half_day' || leaveType === 'short_leave'
      const payload = {
        memberId: targetMemberId,
        leaveType,
        timeSlot: sameDay ? timeSlot : undefined,
        startDate,
        endDate: sameDay ? startDate : endDate,
        reason: reason.trim(),
        isAdmin: tab === 'admin' || isManualLogModalOpen
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

      const saved = {
        ...data,
        member: data.member || allMembers.find((m: any) => m.id === targetMemberId) || { id: targetMemberId, name: 'Employee' },
      }

      if (editingLeaveId) {
        setLeaves(prev => prev.map(l => (l.id === editingLeaveId ? { ...l, ...saved } : l)))
        setPendingLeaves(prev => prev.map(l => (l.id === editingLeaveId ? { ...l, ...saved } : l)))
        setCompanyLeaves(prev => prev.map(l => (l.id === editingLeaveId ? { ...l, ...saved } : l)))
      } else {
        if (targetMemberId === memberId) {
          setLeaves(prev => [saved, ...prev])
        }
        if (isAdmin) {
          setPendingLeaves(prev => [saved, ...prev])
          setCompanyLeaves(prev => [saved, ...prev])
        }
      }

      toast.success(editingLeaveId ? 'Leave updated successfully!' : 'Leave requested successfully!')
      setIsManualLogModalOpen(false)
      resetForm()
      if (!editingLeaveId && targetMemberId === memberId) {
        setMyLeaveFilter('all')
      }
      void refetchLeaveLists()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitApproveReject() {
    if (!confirmModal) return
    const { leaveId, status } = confirmModal
    
    if (!decisionNotes.trim()) {
      toast.error(status === 'rejected' ? 'Please provide a reason for rejection' : 'Please add a comment for approval')
      return
    }

    setIsConfirming(true)
    try {
      const res = await fetch(`/api/leaves/${leaveId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approvalNotes: decisionNotes.trim() })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      decidedPendingIds.current.add(leaveId)
      setPendingLeaves(prev => prev.filter(l => l.id !== leaveId))
      setCompanyLeaves(prev =>
        prev.map(l => (l.id === leaveId ? { ...l, ...data, status, approvalNotes: decisionNotes.trim() } : l))
      )
      setLeaves(prev =>
        prev.map(l => (l.id === leaveId ? { ...l, ...data, status, approvalNotes: decisionNotes.trim() } : l))
      )
      toast.success(status === 'approved' ? 'Leave approved' : 'Leave rejected')
      setConfirmModal(null)
      setDecisionNotes('')
      void refetchLeaveLists()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsConfirming(false)
    }
  }

  const formatLeaveType = (type: string, slot?: string) => {
    let base = type.replace(/_/g, ' ')
    if (slot) {
      base += ` (${slot.replace(/_/g, ' ')})`
    }
    return base
  }

  function unpaidPillLabel(l: any) {
    const paid = Number(l.paidDays || 0)
    const unpaidDays = Number(l.unpaidDays || 0)
    if (!l.unpaid && unpaidDays <= 0) return null
    if (paid > 0 && unpaidDays > 0) return `Partial unpaid (${paid}+${unpaidDays})`
    return 'Unpaid'
  }

  // --- Calendar Helpers ---
  const filteredLeavesForReports = companyLeaves.filter(l => reportEmployeeFilter === 'all' || l.memberId === reportEmployeeFilter)
  const calendarLeaves = filteredLeavesForReports.filter(
    l => l.status === 'approved' || l.status === 'pending'
  )

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDateCalendar = startOfWeek(monthStart)
  const endDateCalendar = endOfWeek(monthEnd)
  
  const calendarDays = eachDayOfInterval({ start: startDateCalendar, end: endDateCalendar })

  const getLeavesForDay = (day: Date, source = filteredLeavesForReports) => {
    return source.filter(l => {
      const s = new Date(l.startDate)
      const e = new Date(l.endDate)
      s.setHours(0,0,0,0)
      e.setHours(0,0,0,0)
      const current = new Date(day)
      current.setHours(0,0,0,0)
      return isWithinInterval(current, { start: s, end: e })
    })
  }

  // Pending paid days reserved (working-day aware; uses stored paidDays when present)
  const pendingDays = leaves
    .filter(
      l =>
        l.status === 'pending' &&
        !['short_leave', 'birthday_leave', 'work_from_home'].includes(l.leaveType)
    )
    .reduce((total, l) => {
      const paid = Number(l.paidDays)
      if (!Number.isNaN(paid) && (paid > 0 || Number(l.unpaidDays || 0) > 0 || l.unpaid)) {
        return total + paid
      }
      return (
        total +
        leaveRequestDayCost(l.leaveType, new Date(l.startDate), new Date(l.endDate))
      )
    }, 0)

  const pendingShortLeaves = leaves.filter(
    l => l.status === 'pending' && l.leaveType === 'short_leave'
  ).length

  const { year: istYearNow, month: istMonthNow } = istYearAndMonth()
  const shortLeavesThisMonth = leaves.filter(l => {
    if (l.leaveType !== 'short_leave' || l.status !== 'approved') return false
    const ym = istYearAndMonth(new Date(l.startDate))
    return ym.year === istYearNow && ym.month === istMonthNow
  }).length

  const approvedThisMonth = companyLeaves.filter(l => {
    if (l.status !== 'approved') return false
    const d = new Date(l.startDate)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const onLeaveToday = getLeavesForDay(new Date()).filter(l => l.status === 'approved').length

  const myLeaveCounts = {
    all: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected' || l.status === 'cancelled').length,
  }
  const filteredMyLeaves =
    myLeaveFilter === 'all'
      ? leaves
      : myLeaveFilter === 'rejected'
        ? leaves.filter(l => l.status === 'rejected' || l.status === 'cancelled')
        : leaves.filter(l => l.status === myLeaveFilter)

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <Toaster position="bottom-right" />

      {/* Confirm Delete Modal */}
      {deleteConfirmLeave && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-red-50/50">
              <h2 className="text-lg font-bold text-gray-900">Delete leave request</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this leave request? This cannot be undone.
              </p>
              <div className="rounded-xl bg-gray-50 ring-1 ring-gray-100 px-4 py-3 text-sm">
                <p className="font-bold text-gray-900 capitalize">
                  {formatLeaveType(deleteConfirmLeave.leaveType, deleteConfirmLeave.timeSlot)}
                </p>
                <p className="text-gray-600 mt-1">
                  {formatLeaveDates(deleteConfirmLeave.startDate, deleteConfirmLeave.endDate)}
                </p>
                {deleteConfirmLeave.unpaid && (
                  <p className="text-xs font-semibold text-orange-700 mt-2">
                    {unpaidPillLabel(deleteConfirmLeave)}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmLeave(null)}
                  className="w-full rounded-xl py-3 text-sm font-bold bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteLeave}
                  className="w-full rounded-xl py-3 text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Revoke Modal */}
      {revokeConfirmLeave && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-amber-50/50">
              <h2 className="text-lg font-bold text-gray-900">Revoke approved leave</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                This will cancel the leave and roll back any paid balance that was deducted.
              </p>
              <div className="rounded-xl bg-gray-50 ring-1 ring-gray-100 px-4 py-3 text-sm">
                <p className="font-bold text-gray-900">
                  {revokeConfirmLeave.member?.name || 'Employee'} ·{' '}
                  <span className="capitalize">
                    {formatLeaveType(revokeConfirmLeave.leaveType, revokeConfirmLeave.timeSlot)}
                  </span>
                </p>
                <p className="text-gray-600 mt-1">
                  {formatLeaveDates(revokeConfirmLeave.startDate, revokeConfirmLeave.endDate)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Reason (required)
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  value={revokeNotes}
                  onChange={e => setRevokeNotes(e.target.value)}
                  className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 px-3 py-2.5"
                  placeholder="Why is this leave being revoked?"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={() => {
                    setRevokeConfirmLeave(null)
                    setRevokeNotes('')
                  }}
                  className="w-full rounded-xl py-3 text-sm font-bold bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={confirmRevokeLeave}
                  className="w-full rounded-xl py-3 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
                >
                  {isRevoking ? 'Revoking…' : 'Revoke leave'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                Are you sure you want to <strong>{confirmModal.status === 'approved' ? 'approve' : 'reject'}</strong> this leave request?
                {confirmModal.status === 'approved' && " The employee will be notified and this leave will be recorded."}
              </p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {confirmModal.status === 'approved' ? 'Approval comment (Required)' : 'Reason for Rejection (Required)'}
                </label>
                <textarea 
                  autoFocus
                  required 
                  value={decisionNotes} 
                  onChange={e => setDecisionNotes(e.target.value)} 
                  rows={3} 
                  className={`w-full text-sm rounded-xl border-gray-200 shadow-sm px-3 py-2.5 ${
                    confirmModal.status === 'approved'
                      ? 'focus:border-green-500 focus:ring-green-500'
                      : 'focus:border-red-500 focus:ring-red-500'
                  }`}
                  placeholder={
                    confirmModal.status === 'approved'
                      ? 'Add a comment for this approval...'
                      : 'Please explain why this leave is being rejected...'
                  } 
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  disabled={isConfirming}
                  onClick={() => {
                    setConfirmModal(null)
                    setDecisionNotes('')
                  }} 
                  className="w-full rounded-xl py-3 text-sm font-bold bg-gray-100 hover:bg-gray-200 transition-colors text-gray-900 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={submitApproveReject}
                  disabled={isConfirming || !decisionNotes.trim()} 
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
                <select value={leaveType} onChange={e => {
                  const next = e.target.value
                  setLeaveType(next)
                  setTimeSlot('')
                  if ((next === 'half_day' || next === 'short_leave') && startDate) {
                    setEndDate(startDate)
                  }
                }} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5">
                  <option value="full_day">Full Day</option>
                  <option value="half_day">Half Day</option>
                  <option value="short_leave">Short Leave (2 hours)</option>
                  <option value="birthday_leave">Birthday Leave</option>
                  <option value="work_from_home">Work From Home</option>
                </select>
                {leaveType === 'half_day' ? (
                  <p className="text-xs text-amber-700 mt-1.5">
                    You must work at least 4.5 hours on this day for it to count as a half day.
                  </p>
                ) : leaveType === 'short_leave' ? (
                  <p className="text-xs text-sky-700 mt-1.5">
                    You must work at least 7 hours on this day for it to count as a short leave.
                  </p>
                ) : null}
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
                    <option value="evening">Evening</option>
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => {
                      const next = e.target.value
                      setStartDate(next)
                      if (isSameDayLeave) setEndDate(next)
                    }}
                    min={istDateInputValue()}
                    className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    min={startDate || istDateInputValue()}
                    disabled={isSameDayLeave}
                    className={`w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 ${
                      isSameDayLeave ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                    }`}
                  />
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
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{selectedLeaveForModal.member?.name || 'Leave Request'}</h3>
                    <p className="text-xs text-gray-500 capitalize">{formatLeaveType(selectedLeaveForModal.leaveType, selectedLeaveForModal.timeSlot)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ring-1 ring-inset
                      ${selectedLeaveForModal.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                        selectedLeaveForModal.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                        'bg-red-50 text-red-700 ring-red-600/20'}`}>
                      {selectedLeaveForModal.status}
                    </span>
                    {selectedLeaveForModal.unpaid && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ring-1 ring-inset bg-orange-50 text-orange-800 ring-orange-600/20">
                        {unpaidPillLabel(selectedLeaveForModal)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold text-gray-600 w-16">Dates:</span>
                    <span className="text-gray-900">
                      {formatIstDate(selectedLeaveForModal.startDate)}
                      {selectedLeaveForModal.startDate !== selectedLeaveForModal.endDate && ` to ${formatIstDate(selectedLeaveForModal.endDate)}`}
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
                          By <span className="font-medium text-gray-700">{log.user?.name || 'Unknown'}</span> on {formatIstDateTimeShort(log.timestamp)}
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {tab === 'admin' ? 'Team Leaves' : 'Leave Management'}
            </h1>
            <LeaveHourPolicyCard />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {tab === 'admin'
              ? 'Review requests, update balances, and see who is out.'
              : 'Check your balance, request time off, and track status.'}
          </p>
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
              className={`inline-flex items-center px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'admin' ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
            >
              Team admin
              <NavCountBadge count={pendingLeaves.length} />
            </button>
          </div>
        )}
      </div>

      {tab === 'my_leaves' && (
        <div className="space-y-6">
          {/* Balance strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl bg-slate-900 text-white p-5 shadow-sm col-span-2 lg:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Available</p>
              <p className="text-4xl font-bold mt-1 tracking-tight">{Math.max(0, accrued - used)}</p>
              <p className="text-xs text-slate-400 mt-1">days you can still take</p>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{accrued}</p>
              <p className="text-xs text-gray-500 mt-1">total this year</p>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-500">Used</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{used}</p>
              <p className="text-xs text-gray-500 mt-1">half / full days taken</p>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">Short leave</p>
              <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
                {shortLeavesThisMonth}/{SHORT_LEAVE_MONTHLY_CAP}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                taken this month
                {pendingShortLeaves > 0 ? ` · ${pendingShortLeaves} pending` : ''}
              </p>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Pending</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingDays}</p>
              <p className="text-xs text-gray-500 mt-1">days awaiting approval</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Apply */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-gray-900/5 sticky top-4">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-900">Request time off</h2>
                  <p className="text-xs text-gray-500 mt-1">HR will review and notify you.</p>
                </div>
                {error && (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl ring-1 ring-red-600/10">
                    {error}
                  </div>
                )}

                <form onSubmit={handleApplyLeave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave type</label>
                    <select
                      value={leaveType}
                      onChange={e => {
                        const next = e.target.value
                        setLeaveType(next)
                        setTimeSlot('')
                        if ((next === 'half_day' || next === 'short_leave') && startDate) {
                          setEndDate(startDate)
                        }
                      }}
                      className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5"
                    >
                      <option value="full_day">Full Day</option>
                      <option value="half_day">Half Day</option>
                      <option value="short_leave">Short Leave (2 hours)</option>
                      <option value="birthday_leave">Birthday Leave</option>
                      <option value="work_from_home">Work From Home</option>
                    </select>
                    {leaveType === 'half_day' ? (
                      <p className="text-xs text-amber-700 mt-1.5">
                        You must work at least 4.5 hours on this day for it to count as a half day.
                      </p>
                    ) : leaveType === 'short_leave' ? (
                      <p className="text-xs text-sky-700 mt-1.5">
                        You must work at least 7 hours on this day for it to count as a short leave.
                      </p>
                    ) : null}
                  </div>

                  {leaveType === 'half_day' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time slot</label>
                      <select
                        required
                        value={timeSlot}
                        onChange={e => setTimeSlot(e.target.value)}
                        className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-slate-50"
                      >
                        <option value="" disabled>Select a slot</option>
                        <option value="before_lunch">Before Lunch</option>
                        <option value="after_lunch">After Lunch</option>
                      </select>
                    </div>
                  )}

                  {leaveType === 'short_leave' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time slot</label>
                      <select
                        required
                        value={timeSlot}
                        onChange={e => setTimeSlot(e.target.value)}
                        className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-slate-50"
                      >
                        <option value="" disabled>Select a slot</option>
                        <option value="morning">Morning</option>
                        <option value="evening">Evening</option>
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={e => {
                          const next = e.target.value
                          setStartDate(next)
                          if (isSameDayLeave) setEndDate(next)
                        }}
                        min={istDateInputValue()}
                        className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">End</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        min={startDate || istDateInputValue()}
                        disabled={isSameDayLeave}
                        className={`w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 ${
                          isSameDayLeave ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
                    <textarea
                      required
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={3}
                      className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5"
                      placeholder="e.g., Medical appointment"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl py-3 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit request'}
                  </button>
                </form>
              </div>
            </div>

            {/* History */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Your requests</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {filteredMyLeaves.length} shown
                    {myLeaveFilter !== 'all' ? ` · ${myLeaveCounts.all} total` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-white p-1 rounded-xl ring-1 ring-gray-200 shadow-sm">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'pending', label: 'Pending' },
                    { key: 'approved', label: 'Approved' },
                    { key: 'rejected', label: 'Rejected' },
                  ] as const
                ).map(tabItem => {
                  const active = myLeaveFilter === tabItem.key
                  const count = myLeaveCounts[tabItem.key]
                  return (
                    <button
                      key={tabItem.key}
                      type="button"
                      onClick={() => setMyLeaveFilter(tabItem.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {tabItem.label}
                      <span
                        className={`min-w-[1.25rem] text-center text-[10px] font-bold px-1 py-0.5 rounded-md ${
                          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {filteredMyLeaves.length === 0 ? (
                <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 px-6 py-16 text-center shadow-sm">
                  <p className="text-base font-semibold text-gray-900">
                    {myLeaveFilter === 'all'
                      ? 'No leave requests yet'
                      : `No ${myLeaveFilter} requests`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {myLeaveFilter === 'all'
                      ? 'Use the form to request time off.'
                      : 'Try another tab or submit a new request.'}
                  </p>
                </div>
              ) : (
                filteredMyLeaves.map(l => (
                  <div
                    key={l.id}
                    className="rounded-2xl bg-white ring-1 ring-gray-900/5 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 capitalize">
                          {formatLeaveType(l.leaveType, l.timeSlot)}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ring-1 ring-inset
                          ${l.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                            l.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                            'bg-red-50 text-red-700 ring-red-600/20'}`}>
                          {l.status}
                        </span>
                        {l.unpaid && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ring-inset bg-orange-50 text-orange-800 ring-orange-600/20">
                            {unpaidPillLabel(l)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-1.5">
                        {formatLeaveDates(l.startDate, l.endDate)}
                      </p>
                      {l.reason && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{l.reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => viewHistory(l)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        Logs
                      </button>
                      {l.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(l)}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmLeave(l)}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'admin' && (
        <div className="space-y-6">
          {/* Summary + quick actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Needs review</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingLeaves.length}</p>
              <p className="text-xs text-gray-500 mt-1">Pending requests</p>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">This month</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{approvedThisMonth}</p>
              <p className="text-xs text-gray-500 mt-1">Approved leaves</p>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">Out today</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{onLeaveToday}</p>
              <p className="text-xs text-gray-500 mt-1">On approved leave</p>
            </div>
            <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-sm flex flex-col justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Quick actions</p>
              <div className="flex flex-col gap-2">
                {canManageBalances && (
                  <>
                    <Link
                      href="/leaves/usage"
                      className="text-sm font-semibold bg-white/10 hover:bg-white/15 rounded-xl px-3 py-2 text-center transition-colors"
                    >
                      Leave usage
                    </Link>
                    <Link
                      href="/leaves/balances"
                      className="text-sm font-semibold bg-white/10 hover:bg-white/15 rounded-xl px-3 py-2 text-center transition-colors"
                    >
                      Edit balances
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsManualLogModalOpen(true)}
                  className="text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors"
                >
                  Log leave manually
                </button>
              </div>
            </div>
          </div>

          {/* Section switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-white p-1 rounded-xl ring-1 ring-gray-200 shadow-sm">
              <button
                type="button"
                onClick={() => setAdminSection('approvals')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  adminSection === 'approvals'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Approvals
                {pendingLeaves.length > 0 && (
                  <span className={`ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                    adminSection === 'approvals' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pendingLeaves.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAdminSection('history')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  adminSection === 'history'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Team history
              </button>
              <button
                type="button"
                onClick={() => setAdminSection('calendar')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  adminSection === 'calendar'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Calendar
              </button>
            </div>
          </div>

          {adminSection === 'approvals' && (
            <div className="space-y-4">
              {pendingLeaves.length === 0 ? (
                <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 px-6 py-16 text-center shadow-sm">
                  <p className="text-lg font-semibold text-gray-900">Nothing to approve</p>
                  <p className="text-sm text-gray-500 mt-1">New leave requests will show up here.</p>
                </div>
              ) : (
                pendingLeaves.map(l => (
                  <div
                    key={l.id}
                    className="rounded-2xl bg-white ring-1 ring-gray-900/5 shadow-sm overflow-hidden"
                  >
                    <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="h-11 w-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-sm font-bold shrink-0">
                          {(l.member.name || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-gray-900">{l.member.name}</h3>
                            <span className="text-[11px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 ring-1 ring-amber-600/15 px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                            {l.unpaid && (
                              <span className="text-[11px] font-semibold uppercase tracking-wide bg-orange-50 text-orange-800 ring-1 ring-orange-600/15 px-2 py-0.5 rounded-full">
                                {unpaidPillLabel(l)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 capitalize">
                            {formatLeaveType(l.leaveType, l.timeSlot)}
                          </p>
                          <p className="text-sm font-medium text-gray-900 mt-2">
                            {formatLeaveDates(l.startDate, l.endDate)}
                          </p>
                          {l.reason ? (
                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                              <span className="font-semibold text-gray-700">Reason:</span> {l.reason}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 mt-2 italic">No reason provided</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => viewHistory(l)}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          Logs
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ leaveId: l.id, status: 'rejected' })}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 ring-1 ring-inset ring-red-600/15 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ leaveId: l.id, status: 'approved' })}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {adminSection === 'history' && companyLeaves.length >= 0 && (
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Team leave history</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Filter by person. All statuses are listed here.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={reportEmployeeFilter}
                    onChange={e => setReportEmployeeFilter(e.target.value)}
                    className="text-sm font-medium rounded-xl border-gray-200 py-2 pl-3 pr-8 focus:border-blue-500 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">All employees</option>
                    {allMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5 text-left">Employee</th>
                        <th className="px-6 py-3.5 text-left">Type</th>
                        <th className="px-6 py-3.5 text-left">Dates</th>
                        <th className="px-6 py-3.5 text-left">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredLeavesForReports.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            <span className="font-medium text-gray-900">No leaves found</span>
                            <span className="block text-xs text-gray-400 mt-1">Try a different employee filter.</span>
                          </td>
                        </tr>
                      ) : (
                        filteredLeavesForReports.map(l => (
                          <tr key={l.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-6 py-4 font-semibold text-gray-900">{l.member.name}</td>
                            <td className="px-6 py-4 capitalize text-gray-600">
                              {formatLeaveType(l.leaveType, l.timeSlot)}
                            </td>
                            <td className="px-6 py-4 text-gray-700">
                              {formatLeaveDates(l.startDate, l.endDate)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ring-1 ring-inset
                                  ${l.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                    l.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                                    'bg-red-50 text-red-700 ring-red-600/20'}`}>
                                  {l.status}
                                </span>
                                {l.unpaid && (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset bg-orange-50 text-orange-800 ring-orange-600/20">
                                    {unpaidPillLabel(l)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => viewHistory(l)}
                                  className="text-gray-500 hover:text-blue-600 font-bold text-xs bg-gray-100 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Logs
                                </button>
                                {l.status === 'approved' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevokeNotes('')
                                      setRevokeConfirmLeave(l)
                                    }}
                                    className="text-amber-800 hover:text-amber-900 font-bold text-xs bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
          )}

          {adminSection === 'calendar' && (
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Leave calendar</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Approved and applied leaves only.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-green-100 ring-1 ring-green-200" />
                      Approved
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 ring-1 ring-amber-200" />
                      Applied
                    </span>
                  </div>
                  <select
                    value={reportEmployeeFilter}
                    onChange={e => setReportEmployeeFilter(e.target.value)}
                    className="text-sm font-medium rounded-xl border-gray-200 py-2 pl-3 pr-8 focus:border-blue-500 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">All employees</option>
                    {allMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h3>
                    <div className="flex space-x-2">
                      <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 ring-1 ring-gray-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <button type="button" onClick={() => setCurrentMonth(new Date())} className="px-3 py-2 text-sm font-bold rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 ring-1 ring-gray-200 transition-colors">Today</button>
                      <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 ring-1 ring-gray-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden ring-1 ring-gray-200">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="bg-gray-50 py-2 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        {day}
                      </div>
                    ))}

                    {calendarDays.map(day => {
                      const isCurrentMonth = isSameMonth(day, currentMonth)
                      const isToday = isSameDay(day, new Date())
                      const dayLeaves = getLeavesForDay(day, calendarLeaves)

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
                                  ${l.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
                                title={`${l.member.name} · ${formatLeaveType(l.leaveType, l.timeSlot)} · ${l.status === 'pending' ? 'Applied' : 'Approved'}`}
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
                <select value={adminMemberId} onChange={e => setAdminMemberId(e.target.value)} className="w-full text-sm rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-white">
                  {allMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
                <select value={leaveType} onChange={e => {
                  const next = e.target.value
                  setLeaveType(next)
                  setTimeSlot('')
                  if ((next === 'half_day' || next === 'short_leave') && startDate) {
                    setEndDate(startDate)
                  }
                }} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5">
                  <option value="full_day">Full Day</option>
                  <option value="half_day">Half Day</option>
                  <option value="short_leave">Short Leave (2 hours)</option>
                  <option value="birthday_leave">Birthday Leave</option>
                  <option value="work_from_home">Work From Home</option>
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
                    <option value="evening">Evening</option>
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => {
                      const next = e.target.value
                      setStartDate(next)
                      if (isSameDayLeave) setEndDate(next)
                    }}
                    className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    disabled={isSameDayLeave}
                    className={`w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 ${
                      isSameDayLeave ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason (Required)</label>
                <textarea required value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5" placeholder="e.g., Sick leave" />
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
