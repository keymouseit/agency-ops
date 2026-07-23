'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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
}

const DEFAULT_STYLE: TypeStyle = { icon: '•', box: 'bg-gray-100', label: 'Update' }

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
  const router = useRouter()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnread(data.unread)
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
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

  async function handleOpen() {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen && unread > 0) {
      await markAllRead()
    }
  }

  async function handleClick(n: Notification) {
    setOpen(false)
    if (n.linkTo) {
      router.push(n.linkTo)
      router.refresh()
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
                <p className="text-xs text-gray-400 mt-1">Updates on projects, QA, and daily ops appear here.</p>
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
