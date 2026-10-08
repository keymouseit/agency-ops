'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Notification = {
  id: string
  type: string
  message: string
  linkTo: string | null
  read: boolean
  createdAt: string
}

type TypeStyle = { icon: string; box: string; label: string }

const TYPE_STYLES: Record<string, TypeStyle> = {
  estimate_requested: { icon: '📋', box: 'bg-blue-100', label: 'Estimate' },
  estimate_confirmed: { icon: '✅', box: 'bg-green-100', label: 'Estimate' },
  estimate_revision: { icon: '↩', box: 'bg-amber-100', label: 'Estimate' },
  estimate_approved: { icon: '🎉', box: 'bg-green-100', label: 'Estimate' },
  blocker_escalated: { icon: '🚨', box: 'bg-red-100', label: 'Blocker' },
  project_assigned: { icon: '📁', box: 'bg-indigo-100', label: 'Project' },
  project_in_qa: { icon: '🔍', box: 'bg-purple-100', label: 'QA' },
  scope_change_requested: { icon: '!', box: 'bg-amber-100', label: 'Scope' },
  scope_change_approved: { icon: '✓', box: 'bg-green-100', label: 'Scope' },
  scope_change_declined: { icon: '✕', box: 'bg-red-100', label: 'Scope' },
  test_cycle_fail: { icon: '⛔', box: 'bg-red-100', label: 'Test cycle' },
  test_cycle_pass: { icon: '✓', box: 'bg-green-100', label: 'Test cycle' },
  test_cycle_fix_ready: { icon: '🔁', box: 'bg-blue-100', label: 'Test cycle' },
  milestone_test_case_failed: { icon: '⛔', box: 'bg-red-100', label: 'Milestone' },
  milestone_bug_logged: { icon: '🐛', box: 'bg-red-100', label: 'Bug' },
  eod_missing: { icon: '⏰', box: 'bg-amber-100', label: 'Daily' },
  leave_applied: { icon: '🏖', box: 'bg-sky-100', label: 'Leave' },
  leave_approved: { icon: '✓', box: 'bg-green-100', label: 'Leave' },
  leave_rejected: { icon: '✕', box: 'bg-red-100', label: 'Leave' },
  mom_attendee: { icon: '📅', box: 'bg-violet-100', label: 'MOM' },
  mom_action_due: { icon: '📌', box: 'bg-amber-100', label: 'MOM' },
  mom_action_overdue: { icon: '⏰', box: 'bg-orange-100', label: 'MOM' },
  mom_action_escalation: { icon: '🚨', box: 'bg-red-100', label: 'MOM' },
  mom_action_blocked: { icon: '🚫', box: 'bg-red-100', label: 'MOM blocked' },
  mom_action_assigned: { icon: '📋', box: 'bg-indigo-100', label: 'MOM' },
  mom_action_done: { icon: '✅', box: 'bg-green-100', label: 'MOM' },
  mom_action_status: { icon: '🔄', box: 'bg-slate-100', label: 'MOM status' },
  mom_action_status_alert: { icon: '🚫', box: 'bg-red-100', label: 'MOM status' },
  mom_followup_completed: { icon: '📞', box: 'bg-sky-100', label: 'MOM' },
  mom_action_nudge: { icon: '👋', box: 'bg-amber-100', label: 'MOM nudge' },
  founder_digest: { icon: '☀️', box: 'bg-gray-100', label: 'Morning digest' },
  weekly_score_reminder: { icon: '📊', box: 'bg-indigo-100', label: 'Weekly score' },
}

const DEFAULT_STYLE: TypeStyle = { icon: '•', box: 'bg-gray-100', label: 'Update' }

/** Toast duration / style hints for high-priority types. */
const TOAST_PRIORITY: Record<string, { duration: number; icon: string }> = {
  mom_action_blocked: { duration: 10000, icon: '🚫' },
  mom_action_escalation: { duration: 8000, icon: '🚨' },
  blocker_escalated: { duration: 8000, icon: '🚨' },
  mom_action_assigned: { duration: 6000, icon: '📋' },
  mom_action_done: { duration: 5000, icon: '✅' },
  mom_action_status: { duration: 10000, icon: '🔄' },
  mom_action_status_alert: { duration: 10000, icon: '🚫' },
  mom_followup_completed: { duration: 6000, icon: '📞' },
  leave_applied: { duration: 6000, icon: '🏖' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function parseMessage(message: string) {
  const dash = message.indexOf(' — ')
  if (dash === -1) return { headline: message, detail: null as string | null }
  return {
    headline: message.slice(0, dash),
    detail: message.slice(dash + 3),
  }
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification
  onClick: () => void
}) {
  const style = TYPE_STYLES[notification.type] ?? DEFAULT_STYLE
  const { headline, detail } = parseMessage(notification.message)
  const unread = !notification.read

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex items-start gap-3 rounded-lg transition-colors hover:bg-gray-50 ${
        unread ? 'bg-blue-50/50' : ''
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm shrink-0 ${style.box}`}
      >
        {style.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {style.label}
          </span>
          {unread && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
        </div>
        <p className={`text-sm leading-snug ${unread ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
          {headline}
        </p>
        {detail && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{detail}</p>}
        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
    </button>
  )
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)
  const router = useRouter()

  const showToastFor = useCallback(
    (n: Notification) => {
      const style = TYPE_STYLES[n.type] ?? DEFAULT_STYLE
      const priority = TOAST_PRIORITY[n.type]
      const { headline, detail } = parseMessage(n.message)
      const icon = priority?.icon ?? style.icon
      const duration = priority?.duration ?? 5000
      const isDanger =
        n.type === 'mom_action_blocked' || n.type === 'mom_action_status_alert'

      toast(
        t => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id)
              if (!n.read) {
                void fetch(`/api/notifications/${n.id}`, {
                  method: 'PATCH',
                  credentials: 'include',
                }).catch(() => {})
              }
              if (n.linkTo) router.push(n.linkTo)
            }}
            className="flex items-start gap-2.5 text-left max-w-xs"
          >
            <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
            <span className="min-w-0">
              <span
                className={`block text-[10px] font-semibold uppercase tracking-wide ${
                  isDanger ? 'text-red-700/70' : 'text-gray-400'
                }`}
              >
                {style.label}
              </span>
              <span
                className={`block text-sm font-medium leading-snug ${
                  isDanger ? 'text-red-950' : 'text-gray-900'
                }`}
              >
                {headline}
              </span>
              {detail && (
                <span
                  className={`block text-xs mt-0.5 leading-snug line-clamp-2 ${
                    isDanger ? 'text-red-900/70' : 'text-gray-500'
                  }`}
                >
                  {detail}
                </span>
              )}
              {n.linkTo && (
                <span
                  className={`block text-[11px] mt-1 font-medium ${
                    isDanger ? 'text-red-700' : 'text-blue-600'
                  }`}
                >
                  Click to open
                </span>
              )}
            </span>
          </button>
        ),
        {
          duration,
          id: `notif-${n.id}`,
          ...(isDanger
            ? {
                style: {
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#7F1D1D',
                },
              }
            : {}),
        }
      )
    },
    [router]
  )

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const list: Notification[] = Array.isArray(data.notifications) ? data.notifications : []

      if (!primedRef.current) {
        // First load: seed seen ids so we don't toast historical unread
        for (const n of list) seenIdsRef.current.add(n.id)
        primedRef.current = true
      } else {
        const fresh = list.filter(n => !n.read && !seenIdsRef.current.has(n.id))
        // Newest first already; toast oldest-of-fresh first so last toast is newest
        for (const n of [...fresh].reverse()) {
          showToastFor(n)
          seenIdsRef.current.add(n.id)
        }
        // Also track any other ids we haven't seen (read ones from other tabs)
        for (const n of list) seenIdsRef.current.add(n.id)
      }

      setNotifications(list)
      setUnread(typeof data.unread === 'number' ? data.unread : 0)
    } catch {}
  }, [showToastFor])

  useEffect(() => {
    fetchNotifications()

    function pollIfVisible() {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
      }
    }

    // 5s poll so in-app recipients see toast promptly (blocked / status / assigned)
    const interval = setInterval(pollIfVisible, 5000)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchNotifications])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    try {
      await fetch('/api/notifications', { method: 'PATCH', credentials: 'include' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch {}
  }

  async function markOneRead(id: string) {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    setUnread(prev => Math.max(0, prev - 1))
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH', credentials: 'include' })
    } catch {
      // Keep optimistic UI; next poll will resync if needed
    }
  }

  async function handleOpen() {
    setOpen(prev => !prev)
  }

  async function handleClick(n: Notification) {
    if (!n.read) {
      void markOneRead(n.id)
    }
    setOpen(false)
    if (n.linkTo) {
      router.push(n.linkTo)
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[22rem] rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3.5 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-base shadow-sm">
                🔔
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                <p className="text-[11px] text-gray-500">
                  {notifications.length === 0
                    ? 'Nothing new'
                    : unread > 0
                      ? `${unread} unread`
                      : 'All caught up'}
                </p>
              </div>
            </div>
            {notifications.some(n => !n.read) && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800 shrink-0"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto p-1.5">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-xl">
                  🔔
                </div>
                <p className="text-sm font-medium text-gray-700">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">Updates on projects, QA, MOM, and daily ops appear here.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {notifications.map(n => (
                  <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
