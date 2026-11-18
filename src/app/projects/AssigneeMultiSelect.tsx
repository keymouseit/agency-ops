'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Member = { id: string; name: string; role?: string }

type MenuPos = { top: number; left: number; width: number; maxHeight: number; openUp: boolean }

export default function AssigneeMultiSelect({
  members,
  selectedIds,
  name = 'developerIds',
  defaultOpen = false,
}: {
  members: Member[]
  selectedIds: string[]
  name?: string
  defaultOpen?: boolean
}) {
  const [ids, setIds] = useState(selectedIds)
  const [open, setOpen] = useState(defaultOpen)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  function updatePos() {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - r.bottom - gap - 8
    const spaceAbove = r.top - gap - 8
    const preferDown = spaceBelow >= 160 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(120, Math.min(224, preferDown ? spaceBelow : spaceAbove))
    const width = Math.min(Math.max(r.width, 288), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    setPos({
      top: preferDown ? r.bottom + gap : r.top - gap,
      left,
      width,
      maxHeight,
      openUp: !preferDown,
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePos()
    function onReposition() {
      updatePos()
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle(id: string) {
    setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const selected = members.filter(m => ids.includes(m.id))
  const summary =
    selected.length === 0
      ? 'Select people…'
      : selected.length <= 2
        ? selected.map(m => m.name).join(', ')
        : `${selected[0].name}, ${selected[1].name} +${selected.length - 2}`

  const menu =
    open && mounted && pos
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            className="fixed z-[300] overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
            style={{
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
          >
            {members.map(m => {
              const checked = ids.includes(m.id)
              return (
                <li key={m.id} role="option" aria-selected={checked} className="min-w-0">
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left min-w-0 ${
                      checked ? 'bg-slate-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggle(m.id)}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white'
                      }`}
                      aria-hidden="true"
                    >
                      {checked ? (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 6.2L4.7 8.4L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 flex items-center justify-between gap-2 overflow-hidden">
                      <span className="text-gray-900 truncate">{m.name}</span>
                      {m.role ? (
                        <span className="text-xs text-gray-400 shrink-0 truncate max-w-[45%]" title={m.role}>
                          {m.role}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative min-w-0">
      {ids.map(id => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <button
        ref={btnRef}
        type="button"
        className="input flex items-center gap-2 text-left bg-white min-w-0"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen(v => !v)}
      >
        <span className={`flex-1 truncate ${selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
          {summary}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {menu}
      {ids.length === 0 ? (
        <p className="mt-1 text-xs text-amber-700">Select at least one person.</p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">{ids.length} selected</p>
      )}
    </div>
  )
}
