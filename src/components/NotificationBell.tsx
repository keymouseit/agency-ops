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

const TYPE_ICONS: Record<string, string> = {
  estimate_requested: '📋',
  estimate_confirmed: '✅',
  estimate_revision:  '↩',
  estimate_approved:  '🎉',
  blocker_escalated:  '🚨',
  project_in_qa:      '🔍',
  scope_change_requested: '!',
  scope_change_approved:  '✓',
  scope_change_declined:  'x',
  test_cycle_fail:    '⛔',
  test_cycle_pass:    '✓',
  eod_missing:        '⏰',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function NotificationBell() {
  const [open, setOpen]                  = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread]              = useState(0)
  const [loading, setLoading]            = useState(false)
  const dropdownRef                      = useRef<HTMLDivElement>(null)
  const router                           = useRouter()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnread(data.unread)
    } catch {}
  }, [])

  // Poll every 30 seconds for new notifications
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleOpen() {
    setOpen(prev => !prev)
    if (!open && unread > 0) {
      // Mark all read when opening
      try {
        await fetch('/api/notifications', { method: 'PATCH', credentials: 'include' })
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnread(0)
      } catch {}
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
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {notifications.some(n => !n.read) && (
              <button
                onClick={async () => {
                  await fetch('/api/notifications', { method: 'PATCH', credentials: 'include' })
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                  setUnread(0)
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50 ${
                    !n.read ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Icon */}
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] ?? '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.read ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
